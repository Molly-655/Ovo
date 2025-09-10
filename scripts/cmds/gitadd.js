const axios = require('axios');

module.exports = {
  config: {
    name: 'gitadd',
    version: '1.1',
    author: 'Molly',
    role: 2,
    description: {
      en: 'Install commands directly to your GitHub repository',
    },
    category: 'owner',
    guide: {
      en: '{pn} install <filename> <content>: Install command file\n{pn} install <code link>: Install from URL',
    },
  },

  onStart: async ({ args, message }) => {
    if (args[0] !== 'install') {
      return message.SyntaxError();
    }

    if (args.length < 3) {
      return message.reply('⚠️ Please provide both filename and content or a valid code link.');
    }

    const fileName = args[1];
    if (!/^[\w\-\.]+\.(js|txt)$/.test(fileName)) {
      return message.reply('❌ Invalid filename. Use only alphanumeric characters with .js or .txt extension.');
    }

    const content = args.slice(2).join(' ');
    
    try {
      let finalContent = content;
      if (content.startsWith('http://') || content.startsWith('https://')) {
        const response = await axios.get(content);
        if (!response.data) throw new Error('Empty content received from link');
        finalContent = response.data;
      }

      await installScript(fileName, finalContent, message);
    } catch (error) {
      console.error('GitAdd Error:', error);
      return message.reply(`❌ Failed to process content: ${error.message}`);
    }
  },
};

async function installScript(fileName, content, message) {
  // 🔧 Your GitHub repo details
  const owner = 'Molly-655';            // your GitHub username
  const repo = 'Ovo';                   // your repository name
  const token = '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'; // your PAT
  const directory = 'scripts/cmds';     // must exist in your repo
  const branch = 'main';                // change to 'master' if repo uses master

  const filePath = `${directory}/${fileName}`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitAdd-Bot'
  };

  try {
    // Check repo exists
    await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });

    let sha = null;
    try {
      const getResponse = await axios.get(apiUrl, { headers });
      sha = getResponse.data.sha;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw new Error(`File check failed: ${error.response?.data?.message || error.message}`);
      }
    }

    const encodedContent = Buffer.from(content).toString('base64');
    const payload = {
      message: `Added ${fileName} via bot`,
      content: encodedContent,
      branch,
    };
    if (sha) payload.sha = sha;

    const response = await axios.put(apiUrl, payload, { headers });

    if ([200, 201].includes(response.status)) {
      return message.reply(`✅ Successfully installed "${fileName}" to GitHub!\n📁 Path: ${filePath}`);
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error);

    let errorMessage = '❌ Installation failed: ';
    if (error.response) {
      switch (error.response.status) {
        case 401:
          errorMessage = '❌ Invalid token. Check token permissions (must have repo:contents write)'; break;
        case 403:
          errorMessage = '❌ Rate limit exceeded or insufficient repo permissions'; break;
        case 404:
          errorMessage = '❌ Repository or directory not found. Verify:\n' +
                         `- Repository exists: github.com/${owner}/${repo}\n` +
                         `- Directory exists: /${directory}`; break;
        case 422:
          errorMessage = '❌ Validation failed. Check filename and content'; break;
        default:
          errorMessage += `${error.response.status}: ${error.response.data?.message || 'Unknown error'}`;
      }
    } else {
      errorMessage += error.message;
    }

    return message.reply(errorMessage);
  }
}
