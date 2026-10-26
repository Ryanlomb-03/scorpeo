/**
 * Custom Shiki theme for Scorpeo
 * Token colors:
 * - keyword: pink
 * - string: green
 * - function: blue
 * - number: orange
 * - type: purple
 * - variable: white
 * - comment: gray
 * - operator: white
 */

export const scorpeoTheme = {
  name: 'scorpeo',
  type: 'dark',
  colors: {
    'editor.background': '#1c1c1e',
    'editor.foreground': '#e3e3e3',
  },
  tokenColors: [
    {
      scope: ['keyword', 'storage.type', 'storage.modifier'],
      settings: {
        foreground: '#ff79c6', // pink
      },
    },
    {
      scope: ['string', 'constant.other.symbol'],
      settings: {
        foreground: '#50fa7b', // green
      },
    },
    {
      scope: ['entity.name.function', 'support.function'],
      settings: {
        foreground: '#8be9fd', // blue
      },
    },
    {
      scope: ['constant.numeric', 'constant.number'],
      settings: {
        foreground: '#ffb86c', // orange
      },
    },
    {
      scope: ['entity.name.type', 'support.type', 'support.class'],
      settings: {
        foreground: '#bd93f9', // purple
      },
    },
    {
      scope: ['variable', 'variable.other'],
      settings: {
        foreground: '#f8f8f2', // white
      },
    },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: {
        foreground: '#6272a4', // gray
        fontStyle: 'italic',
      },
    },
    {
      scope: ['keyword.operator', 'operator'],
      settings: {
        foreground: '#f8f8f2', // white
      },
    },
    {
      scope: ['entity.name.tag', 'support.tag'],
      settings: {
        foreground: '#ff79c6', // pink for tags
      },
    },
    {
      scope: ['entity.other.attribute-name'],
      settings: {
        foreground: '#50fa7b', // green for attributes
      },
    },
  ],
};
