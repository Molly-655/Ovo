const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const axios = require("axios");
const sharp = require("sharp");

// Helper: create a unique temp filepath
function tmpFile(name = "img") {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return path.join(os.tmpdir(), `${name}_${id}.jpg`);
}

// Map of supported filters and how to apply them with sharp
async function applyFilter(inputPath, outputPath, filter, value, color) {
  let img = sharp(inputPath);

  switch ((filter || "").toLowerCase()) {
    case "sepia": {
      // classic sepia tone
      img = img.modulate({ saturation: 0.3 }).tint("#704214");
      break;
    }

    case "bw":
    case "grayscale":
    case "greyscale": {
      img = img.grayscale();
      if (value && !isNaN(+value)) {
        // optional high-contrast threshold (0-255) to get pure black/white
        img = img.threshold(Math.max(0, Math.min(255, Number(value))));
      }
      break;
    }

    case "invert": {
      img = img.negate();
      break;
    }

    case "blur": {
      // value: sigma (0.3 - 100). default 2
      const sigma = value ? Math.max(0.3, Math.min(100, Number(value))) : 2;
      img = img.blur(sigma);
      break;
    }

    case "sharpen": {
      // value: sigma (default 1). Higher = stronger
      const sigma = value ? Math.max(0.1, Math.min(10, Number(value))) : 1;
      img = img.sharpen(sigma);
      break;
    }

    case "brightness": {
      // value: 0.1 - 3 (1 = unchanged)
      const b = value ? Math.max(0.1, Math.min(3, Number(value))) : 1.2;
      img = img.modulate({ brightness: b });
      break;
    }

    case "contrast": {
      // contrast via linear adjustment (slope, intercept)
      // value: 0.5 (lower) to 2 (higher). 1 = unchanged
      const c = value ? Math.max(0.5, Math.min(2, Number(value))) : 1.3;
      const intercept = 128 * (1 - c);
      img = img.linear(c, intercept);
      break;
    }

    case "saturation": {
      // value: 0 (desaturate) to 3 (extra saturated), 1 = unchanged
      const s = value ? Math.max(0, Math.min(3, Number(value))) : 1.5;
      img = img.modulate({ saturation: s });
      break;
    }

    case "hue": {
      // value: degrees 0-360
      const h = value ? Math.max(0, Math.min(360, Number(value))) : 90;
      img = img.modulate({ hue: h });
      break;
    }

    case "tint": {
      // color hex like #ff00aa or css color name
      const c = color || value || "#00bcd4";
      img = img.tint(c);
      break;
    }

    case "pixelate": {
      // value: pixel size (5-100). We downscale then upscale with nearest neighbor
      const block = value ? Math.max(4, Math.min(100, Number(value))) : 12;
      const { width, height } = await sharp(inputPath).metadata();
      const w = Math.max(1, Math.floor(width / block));
      const h = Math.max(1, Math.floor(height / block));
      img = img
        .resize(w, h, { kernel: sharp.kernel.nearest })
        .resize(width, height, { kernel: sharp.kernel.nearest });
      break;
    }

    case "rotate": {
      // value: degrees, default 90
      const deg = value ? Number(value) : 90;
      img = img.rotate(deg);
      break;
    }

    case "flip": {
      img = img.flip();
      break;
    }

    case "flop": {
      img = img.flop();
      break;
    }

    case "vignette": {
      // soft dark corners: compose radial gradient mask
      const { width, height } = await sharp(inputPath).metadata();
      const w = width || 1000;
      const h = height || 1000;

      // Create a radial alpha mask PNG
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
        <svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
          <defs>
            <radialGradient id='g' cx='50%' cy='50%' r='75%'>
              <stop offset='60%' stop-color='white' stop-opacity='0'/>
              <stop offset='100%' stop-color='black' stop-opacity='1'/>
            </radialGradient>
          </defs>
          <rect width='100%' height='100%' fill='url(#g)'/>
        </svg>`;

      const mask = await sharp(Buffer.from(svg)).png().toBuffer();
      const strength = value ? Math.max(0, Math.min(1, Number(value))) : 0.6; // 0-1
      // Dark layer
      const dark = await sharp({ create: { width: w, height: h, channels: 3, background: "#000" }})
        .png()
        .toBuffer();

      img = img
        .composite([
          { input: dark, blend: "multiply", opacity: strength },
          { input: mask, blend: "dest-in" } // apply radial alpha
        ]);
      break;
    }

    default: {
      // Fall back to sepia if unknown
      img = img.modulate({ saturation: 0.3 }).tint("#704214");
    }
  }

  await img.toFile(outputPath);
}

module.exports = {
  config: {
    name: "filter",
    version: "2.0",
    author: "Hassan",
    countDown: 5,
    role: 0,
    shortDescription: "Apply image filters (bw, sepia, blur, etc.)",
    category: "image",
    guide:
      `{pn} <filter> [value] [color]\n\n` +
      `Reply to an image with one of:\n` +
      `- sepia\n` +
      `- bw [threshold 0-255]\n` +
      `- blur [sigma 0.3-100]\n` +
      `- invert\n` +
      `- sharpen [sigma 0.1-10]\n` +
      `- brightness [0.1-3]\n` +
      `- contrast [0.5-2]\n` +
      `- saturation [0-3]\n` +
      `- hue [0-360]\n` +
      `- tint [#hex|cssColor]\n` +
      `- pixelate [block 4-100]\n` +
      `- rotate [deg]\n` +
      `- flip | flop\n` +
      `- vignette [0-1]`
  },

  onStart: async function ({ event, message, args }) {
    const help = (extra = "") => {
      const filterList = [
        "sepia - Apply classic sepia tone",
        "bw [threshold] - Convert to black and white (0-255 threshold)",
        "blur [sigma] - Apply blur effect (0.3-100 sigma)",
        "invert - Invert colors",
        "sharpen [sigma] - Sharpen image (0.1-10 sigma)",
        "brightness [value] - Adjust brightness (0.1-3)",
        "contrast [value] - Adjust contrast (0.5-2)",
        "saturation [value] - Adjust saturation (0-3)",
        "hue [degrees] - Adjust hue (0-360 degrees)",
        "tint [color] - Apply color tint (hex code or color name)",
        "pixelate [block] - Pixelate image (4-100 block size)",
        "rotate [degrees] - Rotate image",
        "flip - Flip vertically",
        "flop - Flip horizontally",
        "vignette [strength] - Apply vignette effect (0-1 strength)"
      ];
      
      return message.reply(
        `🖼️ Image Filter\n\n` +
        `Available filters:\n${filterList.map(f => `• ${f}`).join('\n')}\n\n` +
        `Usage: filter <filter> [value] [color]\n` +
        `Example: filter bw 200\n` +
        `Example: filter blur 4\n` +
        `Example: filter tint #ff00aa\n` +
        (extra ? `\n${extra}` : "")
      );
    };

    try {
      // If no arguments, show available filters
      if (!args || args.length === 0) {
        return help();
      }

      const attachment = event.messageReply?.attachments?.[0];
      if (!attachment || attachment.type !== "photo") {
        return help("❌ Please reply to a photo with your command.");
      }

      const [filter, value, color] = args; // value and color optional
      const imageUrl = attachment.url;

      const inputPath = tmpFile("in");
      const outputPath = tmpFile("out");

      // Download the image
      const res = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 20000 });
      await fsp.writeFile(inputPath, res.data);

      await applyFilter(inputPath, outputPath, filter, value, color);

      await message.reply({
        body: `✅ Applied *${filter}*` + (value ? ` (${value})` : "") + (color ? ` with ${color}` : ""),
        attachment: fs.createReadStream(outputPath)
      });

      // Cleanup
      try { await fsp.unlink(inputPath); } catch {}
      try { await fsp.unlink(outputPath); } catch {}
    } catch (err) {
      console.error("❌ Error applying filter:", err);
      try { await message.reply(`❌ Failed to apply filter.\nError: ${err.message}`); } catch {}
    }
  }
};
