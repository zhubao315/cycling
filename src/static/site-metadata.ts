interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  tagline?: string;
  accent?: string;
  accent2?: string;
  sportLabel?: string;
  repoUrl?: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const data: ISiteMetadataResult = {
  siteTitle: 'zhubao315的骑行生涯',
  siteUrl: 'https://zhubao315.github.io/cycling/',
  logo: 'https://avatars.githubusercontent.com/u/1206487?v=4',
  description: 'zhubao315的骑行生涯 · COROS 自动同步',
  tagline: '两轮丈量城市与郊野，每一次踩踏都算数。',
  accent: '#fb923c',
  accent2: '#f97316',
  sportLabel: '骑行',
  repoUrl: 'https://github.com/zhubao315/cycling',
  navLinks: [
    {
      name: '跑步',
      url: 'https://zhubao315.github.io/running/',
    },
    {
      name: '骑行',
      url: 'https://zhubao315.github.io/cycling/',
    },
    {
      name: '徒步',
      url: 'https://zhubao315.github.io/hiking/',
    },
    {
      name: '健康',
      url: 'https://zhubao315.github.io/health/',
    },
    {
      name: 'X',
      url: 'https://x.com/zhubao315',
    },
  ],
};

export default data
