const fs = require('fs');

const GITHUB_TOKEN = process.env.GH_STATS_TOKEN;
const USERNAME = 'kovacsdonat8';

const query = `
  query {
    user(login: "${USERNAME}") {
      contributionsCollection {
        totalCommitContributions
        restrictedContributionsCount
        totalPullRequestContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
              weekday
            }
          }
        }
      }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        nodes {
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
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

    const json = await response.json();
    if (json.errors) {
        console.error('GraphQL Errors:', JSON.stringify(json.errors, null, 2));
        process.exit(1);
    }

    const user = json.data.user;
    const calendar = user.contributionsCollection.contributionCalendar;
    const totalContributions = calendar.totalContributions;

    const days = calendar.weeks.flatMap(w => w.contributionDays);
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    const weekdayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

    days.forEach((day) => {
        weekdayCounts[day.weekday] += day.contributionCount;
        if (day.contributionCount > 0) {
            tempStreak++;
            if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
            tempStreak = 0;
        }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const validDays = days.filter(d => d.date <= todayStr);
    for (let i = validDays.length - 1; i >= 0; i--) {
        if (validDays[i].contributionCount > 0) {
            currentStreak++;
        } else if (i === validDays.length - 1) {
            continue;
        } else {
            break;
        }
    }

    const maxDayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts));
    const peakDay = weekdayNames[maxDayIndex];

    const monToSunCounts = [...weekdayCounts.slice(1), weekdayCounts[0]];
    const monToSunLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const maxWeekdayCount = Math.max(...monToSunCounts, 1);

    const langMap = {};
    let totalLangSize = 0;

    user.repositories.nodes.forEach(repo => {
        if (!repo.languages || !repo.languages.edges) return;
        repo.languages.edges.forEach(edge => {
            const { name, color } = edge.node;
            const size = edge.size;
            if (!langMap[name]) {
                langMap[name] = { size: 0, color: color || '#6366f1' };
            }
            langMap[name].size += size;
            totalLangSize += size;
        });
    });

    const topLangs = Object.entries(langMap)
        .map(([name, data]) => ({
            name,
            color: data.color,
            size: data.size,
            percent: totalLangSize > 0 ? (data.size / totalLangSize) * 100 : 0,
        }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 6);

    const topLangTotalPercent = topLangs.reduce((acc, l) => acc + l.percent, 0) || 1;

    const barWidth = 340;
    let currentX = 0;
    const stackedBarSegments = topLangs.map((lang) => {
        const segWidth = (lang.percent / topLangTotalPercent) * barWidth;
        const rect = `<rect x="${currentX.toFixed(1)}" y="0" width="${Math.max(segWidth, 2).toFixed(1)}" height="12" fill="${lang.color}" />`;
        currentX += segWidth;
        return rect;
    }).join('\n      ');

    const langLegendItems = topLangs.map((lang, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = col * 175;
        const y = row * 44;
        return `
      <g transform="translate(${x}, ${y})">
        <circle cx="6" cy="6" r="5" fill="${lang.color}" />
        <text x="18" y="10" class="lang-name">${lang.name}</text>
        <text x="18" y="26" class="lang-pct">${lang.percent.toFixed(1)}%</text>
      </g>
    `;
    }).join('');

    const dayBars = monToSunCounts.map((count, idx) => {
        const barMaxH = 38;
        const h = Math.max(Math.round((count / maxWeekdayCount) * barMaxH), 4);
        const x = idx * 24;
        const y = barMaxH - h;
        const isPeak = count === maxWeekdayCount && count > 0;
        const fill = isPeak ? '#38bdf8' : '#334155';
        return `
      <g transform="translate(${x}, 0)">
        <rect x="0" y="0" width="14" height="${barMaxH}" rx="4" fill="#0f172a" />
        <rect x="0" y="${y}" width="14" height="${h}" rx="4" fill="${fill}" />
        <text x="7" y="${barMaxH + 14}" text-anchor="middle" class="day-label">${monToSunLabels[idx]}</text>
      </g>
    `;
    }).join('');

    const svg = `<svg width="800" height="280" viewBox="0 0 800 280" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="800" y2="280" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0b0f19" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="250" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1e293b" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.55" />
    </linearGradient>
    <clipPath id="barClip">
      <rect x="0" y="0" width="${barWidth}" height="12" rx="6" />
    </clipPath>
  </defs>

  <style>
    .card-title { font: 700 11px 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; fill: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase; }
    .metric-val { font: 800 24px 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; fill: #f8fafc; }
    .metric-accent { font: 800 24px 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; fill: #38bdf8; }
    .metric-emerald { font: 800 20px 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; fill: #34d399; }
    .metric-label { font: 500 12px 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; fill: #64748b; }
    .lang-name { font: 600 13px 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; fill: #e2e8f0; }
    .lang-pct { font: 500 11px 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; fill: #64748b; }
    .day-label { font: 600 10px 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; fill: #64748b; }
  </style>

  <rect width="800" height="280" rx="16" fill="url(#bgGrad)" stroke="#1e293b" stroke-width="2" />

  <g transform="translate(24, 24)">
    <rect width="366" height="232" rx="12" fill="url(#cardGrad)" stroke="#1e293b" stroke-width="1" />
    <text x="22" y="30" class="card-title">⚡ Coding Momentum</text>

    <g transform="translate(22, 68)">
      <text x="0" y="0" class="metric-accent">${totalContributions.toLocaleString()}</text>
      <text x="0" y="18" class="metric-label">Contributions (1 yr)</text>
    </g>

    <g transform="translate(195, 68)">
      <text x="0" y="0" class="metric-val">${longestStreak} <tspan font-size="14" font-weight="600" fill="#64748b">days</tspan></text>
      <text x="0" y="18" class="metric-label">Longest Streak (Curr: ${currentStreak}d)</text>
    </g>

    <line x1="22" y1="108" x2="344" y2="108" stroke="#1e293b" stroke-width="1" />

    <g transform="translate(22, 148)">
      <text x="0" y="0" class="metric-emerald">${peakDay}</text>
      <text x="0" y="18" class="metric-label">Most Productive Day</text>
    </g>

    <g transform="translate(180, 126)">
      ${dayBars}
    </g>
    <text x="260" y="196" text-anchor="middle" class="metric-label">Weekly Commit Rhythm</text>
  </g>

  <g transform="translate(410, 24)">
    <rect width="366" height="232" rx="12" fill="url(#cardGrad)" stroke="#1e293b" stroke-width="1" />
    <text x="22" y="30" class="card-title">🛠️ Top Languages by Code Volume</text>

    <g transform="translate(13, 46)" clip-path="url(#barClip)">
      <rect width="${barWidth}" height="12" fill="#0f172a" />
      ${stackedBarSegments}
    </g>

    <g transform="translate(22, 82)">
      ${langLegendItems}
    </g>
  </g>
</svg>`;

    fs.writeFileSync('github-stats.svg', svg);
    console.log('Successfully generated modern github-stats.svg');
}

generateStats().catch(err => {
    console.error(err);
    process.exit(1);
});