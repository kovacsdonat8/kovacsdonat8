const fs = require('fs');

const GITHUB_TOKEN = process.env.GH_STATS_TOKEN;
const USERNAME = 'kovacsdonat8';

const query = `
  query {
    user(login: "${USERNAME}") {
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          stargazerCount
        }
      }
      followers {
        totalCount
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
        }
      }
    }
  }
`;

async function generateStats() {
    const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
    });

    const { data } = await response.json();
    const user = data.user;

    const totalRepos = user.repositories.totalCount;
    const totalStars = user.repositories.nodes.reduce((acc, repo) => acc + repo.stargazerCount, 0);
    const totalFollowers = user.followers.totalCount;
    const totalContributions = user.contributionsCollection.contributionCalendar.totalContributions;

    const svg = `
    <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <style>
        .header { font: 600 18px 'Segoe UI', Arial, sans-serif; fill: #E5E7EB; }
        .stat { font: 600 14px 'Segoe UI', Arial, sans-serif; fill: #9CA3AF; }
        .value { font: 700 14px 'Segoe UI', Arial, sans-serif; fill: #10B981; }
      </style>
      <rect width="100%" height="100%" fill="#111827" rx="8" />
      <text x="25" y="40" class="header">Donát's GitHub Stats</text>

      <text x="25" y="90" class="stat">Total Stars:</text>
      <text x="170" y="90" class="value">${totalStars}</text>

      <text x="25" y="120" class="stat">Total Commits (1 yr):</text>
      <text x="170" y="120" class="value">${totalContributions}</text>

      <text x="25" y="150" class="stat">Total Repositories:</text>
      <text x="170" y="150" class="value">${totalRepos}</text>

      <text x="25" y="180" class="stat">Followers:</text>
      <text x="170" y="180" class="value">${totalFollowers}</text>
    </svg>
  `;

    fs.writeFileSync('github-stats.svg', svg);
    console.log('Successfully generated github-stats.svg');
}

generateStats().catch(console.error);