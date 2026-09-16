module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
      startServerReadyPattern: '4175',
      url: ['http://127.0.0.1:4175/login'],
      numberOfRuns: 1,
      settings: { chromeFlags: '--no-sandbox --headless' }
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.6 }],
        'categories:accessibility': ['warn', { minScore: 0.85 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }]
      }
    },
    upload: { target: 'filesystem', outputDir: './lighthouse-reports' }
  }
};
