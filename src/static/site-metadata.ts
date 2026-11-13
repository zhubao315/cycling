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
  siteTitle: 'zhubao315 的骑行生涯',
  siteUrl: 'https://zhubao315.github.io/cycling/',
  logo: 'https://avatars.githubusercontent.com/u/1206487?v=4',
  description: 'zhubao315 的骑行生涯',
  tagline: '两轮丈量城市与郊野，每一次踩踏都算数。',
  accent: '#FBBF24',
  accent2: '#F59E0B',
  sportLabel: '骑行',
  repoUrl: 'https://github.com/zhubao315/cycling',
  navLinks: [
    {
      name: 'running',
      url: 'https://zhubao315.github.io/running/',
    },
    {
      name: 'cycling',
      url: 'https://zhubao315.github.io/cycling/',
    },
    {
      name: 'hiking',
      url: 'https://zhubao315.github.io/hiking/',
    },
    {
      name: 'health',
      url: 'https://zhubao315.github.io/health/',
    },
  ],
};

export default data
