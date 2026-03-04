const fs = require('fs');
const path = require('path');

// 假设你的文章在 content/posts
const postsDir = path.join(__dirname, '../content/posts');
const outputFile = path.join(__dirname, '../dist/client/rss.xml');

// 读取所有文章
const files = fs.readdirSync(postsDir);
const posts = files.map(file => {
  const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
  const titleMatch = content.match(/title:\s*(.*)/);
  const dateMatch = content.match(/date:\s*(.*)/);
  const title = titleMatch ? titleMatch[1].trim() : file;
  const date = dateMatch ? dateMatch[1].trim() : new Date().toISOString();
  const link = `https://yourdomain.com/posts/${file.replace('.md', '')}`;
  return { title, date, link };
});

// 生成简单 RSS
const rssItems = posts.map(post => `
  <item>
    <title>${post.title}</title>
    <link>${post.link}</link>
    <pubDate>${new Date(post.date).toUTCString()}</pubDate>
  </item>
`).join('');

const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Your Blog Name</title>
    <link>https://yourdomain.com</link>
    <description>最新文章</description>
    ${rssItems}
  </channel>
</rss>
`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, rss);
console.log(`RSS 已生成到 ${outputFile}`);
