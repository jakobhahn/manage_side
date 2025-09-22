import React from 'react'

const config = {
  logo: <span>Hans Restaurant App</span>,
  project: {
    link: 'https://github.com/hansinlack/app'
  },
  chat: {
    link: 'https://github.com/hansinlack/app/discussions'
  },
  docsRepositoryBase: 'https://github.com/hansinlack/app/tree/main/docs',
  footer: {
    text: 'Hans Restaurant App Documentation'
  },
  search: {
    placeholder: 'Search documentation...'
  },
  editLink: {
    text: 'Edit this page on GitHub →'
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback'
  },
  sidebar: {
    titleComponent({ title, type }) {
      if (type === 'separator') {
        return <span className="cursor-default">{title}</span>
      }
      return <>{title}</>
    },
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  toc: {
    backToTop: true
  }
}

export default config
