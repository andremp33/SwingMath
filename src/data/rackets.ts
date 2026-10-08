import { accessoryElements, applyMasses, geometry } from '../domain/physics'
import { DEFAULT_ACCESSORY_MASSES, type Racket } from '../domain/types'

/**
 * Stock library, confirmed on 2026-10-08 against each racket's page on
 * Tennis Warehouse Europe (current frames) or its Learning Center review
 * (earlier generations); URL in `source`. Both measure every frame strung:
 * weight, balance and swingweight below are those strung measurements.
 *
 * The calculator works from the unstrung frame and adds strings itself, so
 * the unstrung reference is derived by removing the same string model the app
 * adds (16 g stringbed). With strings on, the result shows TWE's numbers back.
 * Frames vary by a few grams from unit to unit: measure yours for precision.
 */
type Row = {
  brand: string
  model: string
  year?: number
  type: Racket['type']
  head: number
  lengthCm: number
  /** Strung, as measured by Tennis Warehouse. */
  weight: number
  balanceCm: number
  sw: number
  ra: number
  pattern: string
  url: string
  /** Manufacturer's unstrung nominal values, when the page lists them (used
   *  only to check the string model, see replica/validation.md). */
  nominal?: [weight: number, balanceCm: number]
  /** The page gave no strung weight: nominal unstrung weight + strings. */
  approx?: boolean
}

const T = 'https://www.tenniswarehouse-europe.com/'
const R = 'https://www.tennis-warehouse.com/learning_center/racquet_reviews/'

export const ROWS: Row[] = [
  // Babolat
  { brand: 'Babolat', model: 'Pure Aero 98', year: 2026, type: 'tweener', head: 98, lengthCm: 68.5, weight: 323, balanceCm: 32.49, sw: 322, ra: 66, pattern: '16x20', url: T + 'Babolat_Pure_Aero_98_SINGLE_Racket/descpageRCQBA-BPA98R-EN.html', nominal: [305, 31.5] },
  { brand: 'Babolat', model: 'Pure Aero', year: 2026, type: 'power', head: 100, lengthCm: 68.5, weight: 318, balanceCm: 32.99, sw: 320, ra: 66, pattern: '16x19', url: T + 'Babolat_Pure_Aero_2026_Racket/descpageRCQBA-BPAR26-EN.html', nominal: [300, 32] },
  { brand: 'Babolat', model: 'Pure Aero Team', year: 2026, type: 'power', head: 100, lengthCm: 68.5, weight: 301, balanceCm: 33.02, sw: 306, ra: 66, pattern: '16x19', url: T + 'Babolat_Pure_Aero_Team_2026_Racket/descpageRCQBA-BPAT26-EN.html', nominal: [285, 32] },
  { brand: 'Babolat', model: 'Pure Drive', year: 2025, type: 'power', head: 100, lengthCm: 68.5, weight: 318, balanceCm: 32.99, sw: 317, ra: 69, pattern: '16x19', url: T + 'Babolat_Pure_Drive_2025_Racket_/descpageRCQBA-BPD25R-EN.html', nominal: [300, 32] },
  { brand: 'Babolat', model: 'Pure Drive 98', year: 2025, type: 'tweener', head: 98, lengthCm: 68.5, weight: 323, balanceCm: 33.48, sw: 326, ra: 69, pattern: '16x20', url: T + 'Babolat_Pure_Drive_98_2025_Racket/descpageRCQBA-PD98R-EN.html', nominal: [305, 32.5] },
  { brand: 'Babolat', model: 'Pure Drive Plus', year: 2025, type: 'power', head: 100, lengthCm: 69.9, weight: 318, balanceCm: 33.02, sw: 325, ra: 69, pattern: '16x19', url: T + 'Babolat_Pure_Drive_Plus_2025_Racket_/descpageRCQBA-BPDPR-EN.html', nominal: [300, 32] },
  { brand: 'Babolat', model: 'Pure Drive Team', year: 2025, type: 'power', head: 100, lengthCm: 68.5, weight: 301, balanceCm: 32.64, sw: 308, ra: 69, pattern: '16x19', url: T + 'Babolat_Pure_Drive_Team_2025_Racket_/descpageRCQBA-BRPTR-EN.html', nominal: [285, 32] },
  { brand: 'Babolat', model: 'Pure Strike 100', year: 2025, type: 'control', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 32.99, sw: 324, ra: 63, pattern: '16x19', url: T + 'Babolat_Pure_Strike_100_2025_Racket/descpageRCQBA-PS1019-EN.html' },
  { brand: 'Babolat', model: 'Pure Strike 98 16x19', year: 2025, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.02, sw: 330, ra: 64, pattern: '16x19', url: T + 'Babolat_Pure_Strike_16x19_2025_Racket/descpageRCQBA-PS9816-EN.html' },
  { brand: 'Babolat', model: 'Pure Strike 98 18x20', year: 2025, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.02, sw: 332, ra: 63, pattern: '18x20', url: T + 'Babolat_Pure_Strike_18x20_2025_Racket/descpageRCQBA-PS9818-EN.html' },
  // Head
  { brand: 'Head', model: 'Speed MP', year: 2026, type: 'tweener', head: 100, lengthCm: 68.5, weight: 318, balanceCm: 33.02, sw: 329, ra: 60, pattern: '16x19', url: T + 'Head_Speed_MP_2026_Racket/descpageRCHEAD-HSPMP6-EN.html', nominal: [300, 32] },
  { brand: 'Head', model: 'Speed Pro', year: 2026, type: 'control', head: 100, lengthCm: 68.5, weight: 326, balanceCm: 31.98, sw: 328, ra: 61, pattern: '18x20', url: T + 'Head_Speed_Pro_2026_Racket/descpageRCHEAD-HSPDP6-EN.html', nominal: [310, 31] },
  { brand: 'Head', model: 'Speed MP', year: 2024, type: 'tweener', head: 100, lengthCm: 68.5, weight: 315, balanceCm: 33.02, sw: 330, ra: 60, pattern: '16x19', url: T + 'Head_Speed_MP_2024_Racket/descpageRCHEAD-HSPDM-EN.html', nominal: [300, 32] },
  { brand: 'Head', model: 'Speed Pro', year: 2024, type: 'control', head: 100, lengthCm: 68.5, weight: 329, balanceCm: 32.51, sw: 333, ra: 60, pattern: '18x20', url: T + 'Head_Speed_Pro_2024_Racket/descpageRCHEAD-HSPDP-EN.html', nominal: [310, 31] },
  { brand: 'Head', model: 'Radical MP', year: 2025, type: 'tweener', head: 98, lengthCm: 68.5, weight: 318, balanceCm: 33.02, sw: 323, ra: 66, pattern: '16x19', url: T + 'Head_Radical_MP_2025_Racket/descpageRCHEAD-HRMP-EN.html', nominal: [300, 32] },
  { brand: 'Head', model: 'Radical Pro', year: 2025, type: 'control', head: 98, lengthCm: 68.5, weight: 332, balanceCm: 32.39, sw: 329, ra: 65, pattern: '16x19', url: T + 'Head_Radical_Pro_2025_Racket/descpageRCHEAD-HPRR-EN.html', nominal: [315, 31.5] },
  { brand: 'Head', model: 'Gravity MP', year: 2025, type: 'tweener', head: 100, lengthCm: 68.5, weight: 312, balanceCm: 33.48, sw: 323, ra: 57, pattern: '16x20', url: T + 'Head_Gravity_MP_2025_Racket/descpageRCHEAD-HRMPG-EN.html', nominal: [295, 32.5] },
  { brand: 'Head', model: 'Gravity Pro', year: 2025, type: 'control', head: 100, lengthCm: 68.5, weight: 332, balanceCm: 31.98, sw: 329, ra: 59, pattern: '18x20', url: T + 'Head_Gravity_Pro_2025_Racket/descpageRCHEAD-HGPRR-EN.html', nominal: [315, 31] },
  { brand: 'Head', model: 'Extreme MP', year: 2026, type: 'power', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 32.99, sw: 318, ra: 67, pattern: '16x19', url: T + 'Head_Extreme_MP_2026_Racket/descpageRCHEAD-HEMP26-EN.html' },
  { brand: 'Head', model: 'Boom MP', year: 2026, type: 'power', head: 100, lengthCm: 68.5, weight: 312, balanceCm: 32.49, sw: 316, ra: 61, pattern: '16x19', url: T + 'Head_Boom_MP_2026_Racket/descpageRCHEAD-HBOMP6-EN.html', nominal: [295, 31.5] },
  { brand: 'Head', model: 'Prestige MP', year: 2023, type: 'control', head: 99, lengthCm: 68.5, weight: 326, balanceCm: 33.2, sw: 327, ra: 62, pattern: '18x19', url: T + 'Head_Prestige_MP_2023_Racket/descpageRCHEAD-HPRMP-EN.html', nominal: [310, 32] },
  { brand: 'Head', model: 'Prestige Pro', year: 2023, type: 'control', head: 98, lengthCm: 68.5, weight: 337, balanceCm: 31.98, sw: 324, ra: 58, pattern: '18x20', url: T + 'Head_Prestige_Pro_2023_Racket/descpageRCHEAD-PRPROR-EN.html', nominal: [320, 31] },
  // Wilson
  { brand: 'Wilson', model: 'Blade 98 16x19 v10', year: 2026, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.0, sw: 322, ra: 61, pattern: '16x19', url: T + 'Wilson_Blade_98_16x19_v10_Racket/descpageRCWILSON-WB9810-EN.html' },
  { brand: 'Wilson', model: 'Blade 98 18x20 v10', year: 2026, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.02, sw: 325, ra: 61, pattern: '18x20', url: T + 'Wilson_Blade_98_18x20_v10_Racket/descpageRCWILSON-WB9818-EN.html' },
  { brand: 'Wilson', model: 'Blade 100 v10', year: 2026, type: 'tweener', head: 100, lengthCm: 68.5, weight: 318, balanceCm: 33.0, sw: 319, ra: 61, pattern: '16x19', url: T + 'Wilson_Blade_100_v10_Racket/descpageRCWILSON-WB1001-EN.html' },
  { brand: 'Wilson', model: 'Pro Staff 97 Classic', type: 'control', head: 97, lengthCm: 68.5, weight: 332, balanceCm: 32.0, sw: 325, ra: 66, pattern: '16x19', url: T + 'Wilson_Pro_Staff_97_Classic_Racket/descpageRCWILSON-WPS97C-EN.html', nominal: [315, 31] },
  { brand: 'Wilson', model: 'RF 01 Pro (leather grip)', type: 'control', head: 98, lengthCm: 68.58, weight: 337, balanceCm: 32.39, sw: 331, ra: 67, pattern: '16x19', url: T + 'Wilson_RF_01_PRO_Rackets/descpageRCWILSON-WRFPR-EN.html' },
  { brand: 'Wilson', model: 'Shift 99 (300g)', type: 'tweener', head: 99, lengthCm: 68.58, weight: 318, balanceCm: 32.39, sw: 317, ra: 67, pattern: '16x20', url: T + 'Wilson_Shift_99_300g_Racket/descpageRCWILSON-WSP300-EN.html' },
  { brand: 'Wilson', model: 'Clash 100 v3', year: 2025, type: 'tweener', head: 100, lengthCm: 68.5, weight: 312, balanceCm: 31.98, sw: 311, ra: 54, pattern: '16x19', url: T + 'Wilson_Clash_100_V30_Racket/descpageRCWILSON-WC10V3-EN.html', nominal: [295, 31] },
  { brand: 'Wilson', model: 'Ultra 100 v5', year: 2025, type: 'power', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 33.02, sw: 322, ra: 67, pattern: '16x19', url: T + 'Wilson_Ultra_100_V5_Racket/descpageRCWILSON-WU1005-EN.html' },
  // Yonex
  { brand: 'Yonex', model: 'EZONE 98 (305g)', year: 2025, type: 'tweener', head: 98, lengthCm: 68.5, weight: 323, balanceCm: 32.49, sw: 320, ra: 63, pattern: '16x19', url: T + 'Yonex_EZONE_98_305g_Blast_Blue_Racket/descpageRCYONEX-EZ98BB-EN.html', nominal: [305, 31.5] },
  { brand: 'Yonex', model: 'EZONE 100 (300g)', year: 2025, type: 'power', head: 100, lengthCm: 68.5, weight: 318, balanceCm: 33.02, sw: 315, ra: 68, pattern: '16x19', url: T + 'Yonex_EZONE_100_300g_Blast_Blue_Racket/descpageRCYONEX-EZ10BB-EN.html', nominal: [300, 32] },
  { brand: 'Yonex', model: 'VCORE 98 (305g)', year: 2026, type: 'tweener', head: 98, lengthCm: 68.5, weight: 323, balanceCm: 32.49, sw: 321, ra: 63, pattern: '16x19', url: T + 'Yonex_VCORE_98_Ruby_Red_305g_Racket/descpageRCYONEX-YVC986-EN.html', nominal: [305, 31.5] },
  { brand: 'Yonex', model: 'VCORE 100 (300g)', year: 2026, type: 'power', head: 100, lengthCm: 68.5, weight: 318, balanceCm: 33.02, sw: 325, ra: 65, pattern: '16x19', url: T + 'Yonex_VCORE_100_Ruby_Red_300g_Racket/descpageRCYONEX-YVC106-EN.html', nominal: [300, 32] },
  { brand: 'Yonex', model: 'Percept 97', type: 'control', head: 97, lengthCm: 68.58, weight: 326, balanceCm: 31.98, sw: 315, ra: 60, pattern: '16x19', url: T + 'Yonex_Percept_97_Midnight_Navy_Racket/descpageRCYONEX-YPER97-EN.html' },
  { brand: 'Yonex', model: 'Percept 100', type: 'tweener', head: 100, lengthCm: 68.58, weight: 315, balanceCm: 33.02, sw: 318, ra: 66, pattern: '16x19', url: T + 'Yonex_Percept_100_Midnight_Navy_Racket/descpageRCYONEX-YPER10-EN.html' },
  // Tecnifibre
  { brand: 'Tecnifibre', model: 'TF40 305 16x19', type: 'control', head: 98, lengthCm: 68.5, weight: 320, balanceCm: 33.2, sw: 320, ra: 64, pattern: '16x19', url: T + 'Tecnifibre_TF40_305g_16x19_Racket/descpageRCTECNIH-TF40R1-EN.html', nominal: [305, 32.5] },
  { brand: 'Tecnifibre', model: 'TF40 305 18x20', type: 'control', head: 98, lengthCm: 68.5, weight: 323, balanceCm: 33.32, sw: 330, ra: 64, pattern: '18x20', url: T + 'Tecnifibre_TF40_305g_18x20_Racket/descpageRCTECNIH-TF40R2-EN.html', nominal: [305, 32.5] },
  { brand: 'Tecnifibre', model: 'TFight 305S', type: 'control', head: 98, lengthCm: 68.5, weight: 320, balanceCm: 32.49, sw: 324, ra: 63, pattern: '18x19', url: T + 'Tecnifibre_TFight_305S_Racket/descpageRCTECNIH-TF305S-EN.html', nominal: [305, 31.5] },
  // Solinco
  { brand: 'Solinco', model: 'Whiteout 305 v2', type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.02, sw: 328, ra: 65, pattern: '16x19', url: T + 'Solinco_Whiteout_305_V2_Camo_Racket_/descpageRCNOASOLH-WTOCAH-EN.html' },
  { brand: 'Solinco', model: 'Blackout 300 v2', type: 'power', head: 100, lengthCm: 68.58, weight: 320, balanceCm: 32.51, sw: 317, ra: 66, pattern: '16x19', url: T + 'Solinco_Blackout_300_v2_Camo_Racket_/descpageRCNOASOLH-BKOCAH-EN.html' },
  // Dunlop, Prince
  { brand: 'Dunlop', model: 'CX 200 (305g)', year: 2024, type: 'control', head: 98, lengthCm: 68.5, weight: 320, balanceCm: 32.08, sw: 308, ra: 64, pattern: '16x19', url: T + 'Dunlop_CX_200_305g_Rackets/descpageRCDUNHGER-DCX2S-EN.html', nominal: [305, 31.5] },
  { brand: 'Prince', model: 'Phantom 100X (305g)', year: 2024, type: 'tweener', head: 100, lengthCm: 68.5, weight: 323, balanceCm: 32.49, sw: 320, ra: 59, pattern: '16x18', url: T + 'Prince_Phantom_100X_305g_2024_Racket/descpageRCPRINCEH-PHNX5-EN.html', nominal: [305, 31.5] },
  // Earlier generations (2019-2024), from Tennis Warehouse review pages.
  { brand: 'Babolat', model: 'Pure Aero', year: 2023, type: 'power', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 32.99, sw: 322, ra: 65, pattern: '16x19', url: R + 'BAROreview.html' },
  { brand: 'Babolat', model: 'Pure Aero 98', year: 2023, type: 'tweener', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 32.49, sw: 327, ra: 65, pattern: '16x20', url: R + 'BARO98review.html' },
  { brand: 'Babolat', model: 'Pure Aero', year: 2019, type: 'power', head: 100, lengthCm: 68.58, weight: 317, balanceCm: 33.0, sw: 324, ra: 67, pattern: '16x19', url: R + 'BPARreview.html', approx: true },
  { brand: 'Babolat', model: 'Pure Aero Plus', year: 2019, type: 'power', head: 100, lengthCm: 69.85, weight: 320, balanceCm: 33.0, sw: 330, ra: 68, pattern: '16x19', url: R + 'BPAPRreview.html' },
  { brand: 'Babolat', model: 'Pure Aero Tour', year: 2019, type: 'tweener', head: 100, lengthCm: 68.58, weight: 335, balanceCm: 32.0, sw: 327, ra: 68, pattern: '16x19', url: R + 'BPATRRreview.html' },
  { brand: 'Babolat', model: 'Pure Drive', year: 2021, type: 'power', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 33.0, sw: 320, ra: 71, pattern: '16x19', url: R + 'BRPDRreview.html' },
  { brand: 'Babolat', model: 'Pure Drive Plus', year: 2021, type: 'power', head: 100, lengthCm: 69.85, weight: 318, balanceCm: 33.0, sw: 324, ra: 69, pattern: '16x19', url: R + 'BRPDPreview.html' },
  { brand: 'Babolat', model: 'Pure Drive 107', year: 2021, type: 'power', head: 107, lengthCm: 69.09, weight: 301, balanceCm: 33.0, sw: 309, ra: 69, pattern: '16x19', url: R + 'BRPD17review.html' },
  { brand: 'Babolat', model: 'Pure Strike 100', year: 2019, type: 'control', head: 100, lengthCm: 68.58, weight: 315, balanceCm: 33.0, sw: 319, ra: 69, pattern: '16x19', url: R + 'BPSTRIreview.html' },
  { brand: 'Babolat', model: 'Pure Strike 98 16x19', year: 2019, type: 'control', head: 98, lengthCm: 68.58, weight: 322, balanceCm: 33.0, sw: 327, ra: 66, pattern: '16x19', url: R + 'PS1619review.html', approx: true },
  { brand: 'Babolat', model: 'Pure Strike 98 18x20', year: 2019, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.0, sw: 334, ra: 66, pattern: '18x20', url: R + 'PS182review.html' },
  { brand: 'Babolat', model: 'Pure Strike 98 16x19', year: 2024, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.02, sw: 330, ra: 64, pattern: '16x19', url: R + 'PSRKTreview.html' },
  { brand: 'Babolat', model: 'Pure Strike 100', year: 2024, type: 'control', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 32.99, sw: 324, ra: 63, pattern: '16x19', url: R + 'STRPSreview.html' },
  { brand: 'Babolat', model: 'Pure Strike 97', year: 2024, type: 'control', head: 97, lengthCm: 68.58, weight: 332, balanceCm: 31.98, sw: 321, ra: 63, pattern: '16x20', url: R + 'PS97Sreview.html' },
  { brand: 'Head', model: 'Graphene 360+ Speed MP', year: 2020, type: 'tweener', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 33.0, sw: 328, ra: 64, pattern: '16x19', url: R + 'H3SMIPreview.html' },
  { brand: 'Head', model: 'Graphene 360+ Speed Pro', year: 2020, type: 'control', head: 100, lengthCm: 68.58, weight: 329, balanceCm: 32.46, sw: 329, ra: 62, pattern: '18x20', url: R + 'H3SPROreview.html' },
  { brand: 'Head', model: 'Speed MP', year: 2022, type: 'tweener', head: 100, lengthCm: 68.58, weight: 317, balanceCm: 33.0, sw: 323, ra: 62, pattern: '16x19', url: R + 'SPDMreview.html', approx: true },
  { brand: 'Head', model: 'Speed Pro', year: 2022, type: 'control', head: 100, lengthCm: 68.58, weight: 326, balanceCm: 32.5, sw: 326, ra: 62, pattern: '18x20', url: R + 'SPDPreview.html' },
  { brand: 'Head', model: 'Graphene 360+ Radical MP', year: 2021, type: 'tweener', head: 98, lengthCm: 68.58, weight: 318, balanceCm: 33.0, sw: 326, ra: 65, pattern: '16x19', url: R + 'HRRMPreview.html' },
  { brand: 'Head', model: 'Radical MP', year: 2023, type: 'tweener', head: 98, lengthCm: 68.58, weight: 318, balanceCm: 33.02, sw: 323, ra: 65, pattern: '16x19', url: R + 'HMPRreview.html' },
  { brand: 'Head', model: 'Radical Pro', year: 2023, type: 'control', head: 98, lengthCm: 68.58, weight: 332, balanceCm: 32.38, sw: 325, ra: 64, pattern: '16x19', url: R + 'HRPRreview.html' },
  { brand: 'Head', model: 'Graphene 360+ Gravity Pro', year: 2019, type: 'control', head: 100, lengthCm: 68.58, weight: 332, balanceCm: 32.0, sw: 332, ra: 62, pattern: '18x20', url: R + 'HGPG36review.html' },
  { brand: 'Head', model: 'Extreme MP', year: 2022, type: 'power', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 33.0, sw: 322, ra: 66, pattern: '16x19', url: R + 'HREM22review.html' },
  { brand: 'Head', model: 'Extreme Pro', year: 2024, type: 'tweener', head: 98, lengthCm: 68.58, weight: 322, balanceCm: 32.49, sw: 322, ra: 64, pattern: '16x19', url: R + 'HREP24review.html', approx: true },
  { brand: 'Head', model: 'Boom MP', year: 2022, type: 'power', head: 100, lengthCm: 68.58, weight: 312, balanceCm: 33.0, sw: 318, ra: 64, pattern: '16x19', url: R + 'BOOMMreview.html', approx: true },
  { brand: 'Head', model: 'Boom MP', year: 2024, type: 'power', head: 100, lengthCm: 68.58, weight: 312, balanceCm: 32.49, sw: 317, ra: 62, pattern: '16x19', url: R + 'HBOOMMreview.html' },
  { brand: 'Head', model: 'Boom Pro', year: 2024, type: 'tweener', head: 98, lengthCm: 68.58, weight: 326, balanceCm: 31.98, sw: 323, ra: 64, pattern: '16x19', url: R + 'HBOOMPreview.html' },
  { brand: 'Head', model: 'Prestige MP', year: 2021, type: 'control', head: 99, lengthCm: 68.58, weight: 326, balanceCm: 33.0, sw: 334, ra: 66, pattern: '18x19', url: R + 'MIPPREreview.html' },
  { brand: 'Wilson', model: 'Blade 98 16x19 v8', year: 2021, type: 'control', head: 98, lengthCm: 68.58, weight: 320, balanceCm: 33.0, sw: 320, ra: 61, pattern: '16x19', url: R + '16BV8Rreview.html' },
  { brand: 'Wilson', model: 'Blade 98 18x20 v8', year: 2021, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.0, sw: 327, ra: 60, pattern: '18x20', url: R + '20BV8Sreview.html' },
  { brand: 'Wilson', model: 'Blade 100 v8', year: 2021, type: 'tweener', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 33.02, sw: 318, ra: 60, pattern: '16x19', url: R + 'WB1008review.html' },
  { brand: 'Wilson', model: 'Blade 98 16x19 v9', year: 2024, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.02, sw: 324, ra: 62, pattern: '16x19', url: R + 'WB9816review.html' },
  { brand: 'Wilson', model: 'Blade 98 18x20 v9', year: 2024, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.02, sw: 330, ra: 60, pattern: '18x20', url: R + 'WB18Vreview.html' },
  { brand: 'Wilson', model: 'Blade 100 v9', year: 2024, type: 'tweener', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 33.02, sw: 322, ra: 60, pattern: '16x19', url: R + 'WB1009review.html' },
  { brand: 'Wilson', model: 'Blade 104 v9', year: 2024, type: 'tweener', head: 104, lengthCm: 69.85, weight: 306, balanceCm: 32.99, sw: 311, ra: 64, pattern: '16x19', url: R + 'WB104review.html' },
  { brand: 'Wilson', model: 'Clash 100', year: 2019, type: 'tweener', head: 100, lengthCm: 68.58, weight: 312, balanceCm: 31.4, sw: 312, ra: 55, pattern: '16x19', url: R + 'WC100Rreview.html' },
  { brand: 'Wilson', model: 'Clash 100 v2', year: 2022, type: 'tweener', head: 100, lengthCm: 68.58, weight: 312, balanceCm: 32.0, sw: 313, ra: 57, pattern: '16x19', url: R + 'WC100Vreview.html' },
  { brand: 'Wilson', model: 'Clash 100 Pro v2', year: 2022, type: 'control', head: 100, lengthCm: 68.58, weight: 326, balanceCm: 31.0, sw: 325, ra: 59, pattern: '16x20', url: R + 'WC100Preview.html' },
  { brand: 'Wilson', model: 'Clash 98 v2', year: 2022, type: 'control', head: 98, lengthCm: 68.58, weight: 326, balanceCm: 31.75, sw: 327, ra: 60, pattern: '16x20', url: R + 'WC98Preview.html' },
  { brand: 'Wilson', model: 'Pro Staff 97 v14', year: 2023, type: 'control', head: 97, lengthCm: 68.58, weight: 332, balanceCm: 32.0, sw: 332, ra: 66, pattern: '16x19', url: R + 'W97V14review.html' },
  { brand: 'Wilson', model: 'Pro Staff X v14', year: 2023, type: 'control', head: 100, lengthCm: 68.58, weight: 332, balanceCm: 32.0, sw: 322, ra: 66, pattern: '16x19', url: R + 'W97VXreview.html' },
  { brand: 'Wilson', model: 'RF 01', year: 2024, type: 'tweener', head: 98, lengthCm: 68.58, weight: 317, balanceCm: 32.64, sw: 319, ra: 64, pattern: '16x19', url: R + 'WRF1Rreview.html', approx: true },
  // More brands, earlier generations (2020-2025), from Tennis Warehouse review pages.
  { brand: 'Wilson', model: 'Pro Staff Six.One 100 v14', year: 2023, type: 'tweener', head: 100, lengthCm: 68.58, weight: 323, balanceCm: 32.49, sw: 326, ra: 65, pattern: '16x19', url: R + 'WPS614review.html' },
  { brand: 'Wilson', model: 'Shift 99 Pro', year: 2023, type: 'control', head: 99, lengthCm: 68.58, weight: 332, balanceCm: 32.39, sw: 332, ra: 68, pattern: '18x20', url: R + 'WSP315review.html' },
  { brand: 'Wilson', model: 'Ultra 100 v4', year: 2022, type: 'power', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 33.02, sw: 317, ra: 70, pattern: '16x19', url: R + 'WU10V4review.html' },
  { brand: 'Wilson', model: 'Ultra Pro 16x19 v4', year: 2023, type: 'control', head: 97, lengthCm: 68.58, weight: 323, balanceCm: 32.41, sw: 317, ra: 62, pattern: '16x19', url: R + 'WUPRO6review.html' },
  { brand: 'Yonex', model: 'EZONE 98', year: 2022, type: 'tweener', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 32.39, sw: 318, ra: 65, pattern: '16x19', url: R + 'EZO98review.html' },
  { brand: 'Yonex', model: 'EZONE 100', year: 2022, type: 'power', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 33.02, sw: 317, ra: 67, pattern: '16x19', url: R + 'EZO10review.html' },
  { brand: 'Yonex', model: 'EZONE 98 Tour', year: 2022, type: 'control', head: 98, lengthCm: 68.58, weight: 332, balanceCm: 33.02, sw: 332, ra: 64, pattern: '16x19', url: R + 'EZ98TRreview.html' },
  { brand: 'Yonex', model: 'VCORE 98', year: 2023, type: 'tweener', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 32.49, sw: 318, ra: 62, pattern: '16x19', url: R + 'YVC98review.html' },
  { brand: 'Yonex', model: 'VCORE 100', year: 2023, type: 'power', head: 100, lengthCm: 68.58, weight: 320, balanceCm: 33.02, sw: 322, ra: 65, pattern: '16x19', url: R + 'VCR100review.html' },
  { brand: 'Yonex', model: 'VCORE 95', year: 2023, type: 'control', head: 95, lengthCm: 68.58, weight: 326, balanceCm: 32.07, sw: 321, ra: 61, pattern: '16x20', url: R + 'YVC95review.html' },
  { brand: 'Yonex', model: 'VCORE 98', year: 2021, type: 'tweener', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 32.49, sw: 325, ra: 66, pattern: '16x19', url: R + 'YVCR98review.html' },
  { brand: 'Yonex', model: 'VCORE 100', year: 2021, type: 'power', head: 100, lengthCm: 68.58, weight: 320, balanceCm: 33.02, sw: 324, ra: 66, pattern: '16x19', url: R + 'YVC100review.html' },
  { brand: 'Yonex', model: 'VCORE Pro 97 (310g)', year: 2021, type: 'control', head: 97, lengthCm: 68.58, weight: 326, balanceCm: 31.98, sw: 318, ra: 60, pattern: '16x19', url: R + '310VD7review.html' },
  { brand: 'Yonex', model: 'VCORE Pro 97D', year: 2021, type: 'control', head: 97, lengthCm: 68.58, weight: 340, balanceCm: 31.98, sw: 330, ra: 61, pattern: '18x20', url: R + '320HD7review.html' },
  { brand: 'Yonex', model: 'Percept 100D', year: 2023, type: 'tweener', head: 100, lengthCm: 68.58, weight: 320, balanceCm: 32.49, sw: 318, ra: 66, pattern: '18x19', url: R + 'PERC1Dreview.html' },
  { brand: 'Yonex', model: 'Percept 97D', year: 2023, type: 'control', head: 97, lengthCm: 68.58, weight: 337, balanceCm: 31.98, sw: 329, ra: 62, pattern: '18x20', url: R + 'PERC9Dreview.html' },
  { brand: 'Yonex', model: 'Percept 97H', year: 2023, type: 'control', head: 97, lengthCm: 68.58, weight: 346, balanceCm: 31.98, sw: 333, ra: 62, pattern: '16x19', url: R + 'PERC9Hreview.html' },
  { brand: 'Tecnifibre', model: 'TF40 315 16x19', year: 2022, type: 'control', head: 98, lengthCm: 68.58, weight: 332, balanceCm: 31.78, sw: 313, ra: 64, pattern: '16x19', url: R + 'TF4THreview.html' },
  { brand: 'Tecnifibre', model: 'TFight 300 ISO', year: 2022, type: 'tweener', head: 98, lengthCm: 68.58, weight: 318, balanceCm: 32.99, sw: 320, ra: 66, pattern: '16x19', url: R + 'ISO300review.html' },
  { brand: 'Tecnifibre', model: 'TFight 305 ISO', year: 2022, type: 'control', head: 98, lengthCm: 68.58, weight: 320, balanceCm: 33.32, sw: 338, ra: 64, pattern: '18x19', url: R + 'ISO305review.html' },
  { brand: 'Tecnifibre', model: 'TFight 315 ISO', year: 2022, type: 'control', head: 98, lengthCm: 68.58, weight: 329, balanceCm: 31.98, sw: 324, ra: 69, pattern: '16x19', url: R + 'ISO315review.html' },
  { brand: 'Tecnifibre', model: 'TFight 300S', year: 2025, type: 'tweener', head: 98, lengthCm: 68.58, weight: 318, balanceCm: 33.02, sw: 321, ra: 66, pattern: '16x19', url: R + 'TF300Sreview.html' },
  { brand: 'Tecnifibre', model: 'TFight 315S', year: 2025, type: 'control', head: 98, lengthCm: 68.58, weight: 332, balanceCm: 31.98, sw: 325, ra: 65, pattern: '16x19', url: R + 'TF315Sreview.html' },
  { brand: 'Prince', model: 'ATS Textreme Tour 100 (310g)', year: 2022, type: 'tweener', head: 100, lengthCm: 68.58, weight: 326, balanceCm: 31.98, sw: 323, ra: 62, pattern: '16x18', url: R + 'ATR310review.html' },
  { brand: 'Prince', model: 'ATS Textreme Tour 98', year: 2022, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 32.49, sw: 325, ra: 62, pattern: '16x19', url: R + 'ATR98review.html' },
  { brand: 'Prince', model: 'Phantom 100X (305g)', year: 2020, type: 'tweener', head: 100, lengthCm: 68.58, weight: 323, balanceCm: 32.26, sw: 321, ra: 58, pattern: '16x18', url: R + 'PPX35review.html' },
  { brand: 'Prince', model: 'Phantom 97P', year: 2020, type: 'control', head: 97, lengthCm: 68.58, weight: 335, balanceCm: 31.75, sw: 320, ra: 58, pattern: '16x18', url: R + 'PP97Preview.html' },
  { brand: 'Prince', model: 'Phantom 100P', year: 2024, type: 'control', head: 100, lengthCm: 68.58, weight: 326, balanceCm: 32.49, sw: 324, ra: 59, pattern: '16x18', url: R + 'PHNP1review.html' },
  { brand: 'Dunlop', model: 'CX 200 Tour 16x19', year: 2021, type: 'control', head: 95, lengthCm: 68.58, weight: 326, balanceCm: 31.98, sw: 318, ra: 63, pattern: '16x19', url: R + 'D200T6review.html' },
  { brand: 'Dunlop', model: 'SX 300', year: 2022, type: 'power', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 33.02, sw: 322, ra: 68, pattern: '16x19', url: R + 'X300DUreview.html' },
  { brand: 'Dunlop', model: 'SX 300 Tour', year: 2022, type: 'tweener', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 32.49, sw: 324, ra: 66, pattern: '16x19', url: R + 'T310DUreview.html' },
  { brand: 'Dunlop', model: 'FX 500', year: 2023, type: 'power', head: 100, lengthCm: 68.58, weight: 320, balanceCm: 33.02, sw: 321, ra: 69, pattern: '16x19', url: R + 'DFX500review.html' },
  { brand: 'Dunlop', model: 'FX 500 Tour', year: 2023, type: 'tweener', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 32.49, sw: 317, ra: 65, pattern: '16x19', url: R + 'FX5TRreview.html' },
  { brand: 'Solinco', model: 'Blackout 300', year: 2022, type: 'power', head: 100, lengthCm: 68.58, weight: 320, balanceCm: 32.51, sw: 316, ra: 71, pattern: '16x19', url: R + 'BLKO30review.html' },
  { brand: 'Solinco', model: 'Whiteout 305', year: 2022, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.02, sw: 327, ra: 66, pattern: '16x19', url: R + 'WHTO30review.html' },
  { brand: 'Solinco', model: 'Whiteout 305 18x20', year: 2023, type: 'control', head: 98, lengthCm: 68.58, weight: 323, balanceCm: 33.02, sw: 324, ra: 66, pattern: '18x20', url: R + 'WHO18Xreview.html' },
  { brand: 'Völkl', model: 'V-Cell 8 (315g)', year: 2020, type: 'tweener', head: 100, lengthCm: 68.58, weight: 326, balanceCm: 32.23, sw: 315, ra: 66, pattern: '16x18', url: R + 'VVCL8review.html' },
  { brand: 'Völkl', model: 'V-Cell 8 (300g)', year: 2020, type: 'power', head: 100, lengthCm: 68.58, weight: 312, balanceCm: 32.64, sw: 312, ra: 67, pattern: '16x18', url: R + 'VVC8Lreview.html' },
  { brand: 'Völkl', model: 'V-Cell 10 (320g)', year: 2021, type: 'control', head: 98, lengthCm: 68.58, weight: 335, balanceCm: 31.98, sw: 319, ra: 67, pattern: '16x19', url: R + 'VCE102review.html' },
  { brand: 'Völkl', model: 'Vostra V8 (300g)', year: 2024, type: 'power', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 32.64, sw: 323, ra: 67, pattern: '16x19', url: R + 'VOSV8Mreview.html' },
  { brand: 'Völkl', model: 'Vostra V8 (315g)', year: 2024, type: 'tweener', head: 100, lengthCm: 68.58, weight: 329, balanceCm: 32.49, sw: 319, ra: 66, pattern: '16x18', url: R + 'VOSV8Hreview.html' },
  { brand: 'ProKennex', model: 'Black Ace 300', year: 2025, type: 'tweener', head: 100, lengthCm: 68.58, weight: 318, balanceCm: 32.99, sw: 324, ra: 55, pattern: '16x19', url: R + 'PKBACreview.html' },
]

/** Removes the app's string model from strung measurements. */
export function unstrungFromStrung(r: Pick<Row, 'head' | 'lengthCm' | 'weight' | 'balanceCm' | 'sw'>) {
  const g = geometry(r.lengthCm, r.head)
  const [strings] = accessoryElements(g, { strings: true, leatherGrip: false, overgrip: false, dampener: false }, DEFAULT_ACCESSORY_MASSES)
  const own = strings.ownSwing ?? 0
  const weightG = r.weight - strings.grams
  const balanceCm = (r.weight * r.balanceCm - strings.grams * strings.x) / weightG
  const swingweight = r.sw - (strings.grams * (strings.x - 10) ** 2 + own) / 1000
  return { weightG, balanceCm, swingweight }
}

/** What the string model predicts strung, from the manufacturer's unstrung
 *  nominal values (for the validation table). */
export function predictStrung(r: Row) {
  if (!r.nominal) return undefined
  const g = geometry(r.lengthCm, r.head)
  const s = applyMasses(
    { lengthCm: r.lengthCm, headSizeSqIn: r.head, weightG: r.nominal[0], balanceCm: r.nominal[1], swingweight: 0 },
    accessoryElements(g, { strings: true, leatherGrip: false, overgrip: false, dampener: false }, DEFAULT_ACCESSORY_MASSES),
  )
  return { weightG: s.weightG, balanceCm: s.balanceCm }
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export const STOCK_RACKETS: Racket[] = ROWS.map((r) => {
  const u = unstrungFromStrung(r)
  return {
    id: `stock-${r.brand}-${r.model}-${r.year ?? ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
    brand: r.brand,
    model: r.model,
    year: r.year,
    type: r.type,
    isStock: true,
    lengthCm: r.lengthCm,
    headSizeSqIn: r.head,
    weightG: r1(u.weightG),
    balanceCm: r2(u.balanceCm),
    swingweight: r1(u.swingweight),
    ra: r.ra,
    pattern: r.pattern,
    strung: { weightG: r.weight, balanceCm: r.balanceCm, swingweight: r.sw },
    source: r.url,
    approxWeight: r.approx || undefined,
    createdAt: 0,
    updatedAt: 0,
  }
})

export const BRANDS = [...new Set(STOCK_RACKETS.map((r) => r.brand))].sort()
