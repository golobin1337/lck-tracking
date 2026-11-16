// Mapa compacto ISO alpha-2 → { id numérico ISO (match com o topojson), nome PT }.
// Cobre os países mais comuns de tráfego de um infoproduto BR. Códigos fora da
// lista aparecem nas tabelas pelo próprio código (mapa fica neutro).

export const COUNTRIES: Record<string, { id: string; name: string }> = {
  BR: { id: '076', name: 'Brasil' },
  PT: { id: '620', name: 'Portugal' },
  US: { id: '840', name: 'Estados Unidos' },
  AR: { id: '032', name: 'Argentina' },
  MX: { id: '484', name: 'México' },
  CL: { id: '152', name: 'Chile' },
  CO: { id: '170', name: 'Colômbia' },
  PE: { id: '604', name: 'Peru' },
  UY: { id: '858', name: 'Uruguai' },
  PY: { id: '600', name: 'Paraguai' },
  BO: { id: '068', name: 'Bolívia' },
  VE: { id: '862', name: 'Venezuela' },
  EC: { id: '218', name: 'Equador' },
  ES: { id: '724', name: 'Espanha' },
  FR: { id: '250', name: 'França' },
  DE: { id: '276', name: 'Alemanha' },
  IT: { id: '380', name: 'Itália' },
  GB: { id: '826', name: 'Reino Unido' },
  IE: { id: '372', name: 'Irlanda' },
  NL: { id: '528', name: 'Países Baixos' },
  BE: { id: '056', name: 'Bélgica' },
  CH: { id: '756', name: 'Suíça' },
  CA: { id: '124', name: 'Canadá' },
  AU: { id: '036', name: 'Austrália' },
  JP: { id: '392', name: 'Japão' },
  AO: { id: '024', name: 'Angola' },
  MZ: { id: '508', name: 'Moçambique' },
  CV: { id: '132', name: 'Cabo Verde' },
  ZA: { id: '710', name: 'África do Sul' },
}

export function countryName(code: string | null | undefined): string {
  if (!code) return '—'
  return COUNTRIES[code.toUpperCase()]?.name ?? code.toUpperCase()
}

export function countryNumericId(code: string): string | null {
  return COUNTRIES[code.toUpperCase()]?.id ?? null
}
