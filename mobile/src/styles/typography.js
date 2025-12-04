// Typography system matching web app
export const typography = {
  // Font family - using Lato font
  fontFamily: {
    regular: 'Lato_400Regular',
    light: 'Lato_300Light',
    semibold: 'Lato_700Bold',
    bold: 'Lato_900Black',
    black: 'Lato_900Black',
  },
  
  // Font sizes matching web app
  fontSize: {
    xs: 11,
    sm: 12,
    base: 13,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 22,
    huge: 28,
    massive: 32,
  },
  
  // Font weights
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '800',
    black: '900',
  },
  
  // Helper function to get font family based on weight
  getFontFamily: (weight = 'regular') => {
    const weightMap = {
      '300': 'Lato_300Light',
      '400': 'Lato_400Regular',
      '500': 'Lato_400Regular', // Medium uses regular
      '600': 'Lato_700Bold',
      '700': 'Lato_700Bold',
      '800': 'Lato_900Black',
      '900': 'Lato_900Black',
      light: 'Lato_300Light',
      regular: 'Lato_400Regular',
      medium: 'Lato_400Regular',
      semibold: 'Lato_700Bold',
      bold: 'Lato_900Black',
      black: 'Lato_900Black',
    };
    return weightMap[weight] || 'Lato_400Regular';
  },
};


