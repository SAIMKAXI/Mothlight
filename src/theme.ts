export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export type ThemeColors = {
  background: string;
  surface: string;
  paperStage: string;
  text: string;
  muted: string;
  secondaryText: string;
  toolbar: string;
  toolbarText: string;
  border: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  card: string;
  cardBorder: string;
  input: string;
  danger: string;
  dangerBackground: string;
  rail: string;
  railHighlight: string;
  carriage: string;
  carriageBorder: string;
  typebar: string;
  paperEdge: string;
  panelIcon: string;
  panelIconDanger: string;
  panelBorder: string;
  sheetHandle: string;
  switchOff: string;
  switchOn: string;
  switchThumb: string;
  inverseText: string;
  icon: string;
  iconMuted: string;
  overlay: string;
  shadow: string;
};

export const themePalettes: Record<ResolvedTheme, ThemeColors> = {
  light: {
    background: '#D4D0CD',
    surface: '#E1DEDB',
    paperStage: '#D4D0CD',
    text: '#29272A',
    muted: '#777277',
    secondaryText: '#5F5B5E',
    toolbar: '#777477',
    toolbarText: '#E9E7E4',
    border: '#AAA5A6',
    accent: '#C2D3A9',
    accentText: '#29272A',
    accentSoft: '#D3DEC4',
    card: '#D2D0C9',
    cardBorder: '#B8B4B1',
    input: '#CFCCCA',
    danger: '#A36E67',
    dangerBackground: '#E5D3CF',
    rail: '#494649',
    railHighlight: '#AAA4A2',
    carriage: '#999494',
    carriageBorder: '#777174',
    typebar: '#514C4F',
    paperEdge: '#B9B3B1',
    panelIcon: '#D3D1C8',
    panelIconDanger: '#E5D3CF',
    panelBorder: '#BEB8B7',
    sheetHandle: '#B3ADAB',
    switchOff: '#B9B4B3',
    switchOn: '#A5B494',
    switchThumb: '#F0ECE8',
    inverseText: '#F1EFEA',
    icon: '#5C6658',
    iconMuted: '#777277',
    overlay: 'rgba(35,32,33,0.25)',
    shadow: '#29272A',
  },
  dark: {
    background: '#1D2121',
    surface: '#272C2B',
    paperStage: '#222626',
    text: '#EEE8DC',
    muted: '#AAA7A0',
    secondaryText: '#C7C2B8',
    toolbar: '#373B3B',
    toolbarText: '#F0EDE5',
    border: '#4B514D',
    accent: '#A9C08F',
    accentText: '#202522',
    accentSoft: '#394637',
    card: '#303635',
    cardBorder: '#4A514E',
    input: '#2D3331',
    danger: '#E0A097',
    dangerBackground: '#493331',
    rail: '#0D1111',
    railHighlight: '#6B716B',
    carriage: '#4C514D',
    carriageBorder: '#6F766D',
    typebar: '#DDD6C9',
    paperEdge: '#464B49',
    panelIcon: '#3B423C',
    panelIconDanger: '#493331',
    panelBorder: '#474D4A',
    sheetHandle: '#555B56',
    switchOff: '#4C524D',
    switchOn: '#76896B',
    switchThumb: '#E9E5DB',
    inverseText: '#F0EDE5',
    icon: '#C2D3A9',
    iconMuted: '#AAA7A0',
    overlay: 'rgba(0,0,0,0.58)',
    shadow: '#000000',
  },
};

export function resolveTheme(mode: ThemeMode, systemScheme: 'light' | 'dark' | null | undefined): ResolvedTheme {
  if (mode === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return mode;
}
