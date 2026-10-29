import React from 'react';
import { BoardThemeId, PieceStyle } from '../game/chessEngine';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  subtitle: string;
  lightSquare: string;
  darkSquare: string;
  borderHex: string;
  coordLight: string;
  coordDark: string;
  highlightMove: string;
  highlightLegal: string;
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  tournament_emerald: {
    id: 'tournament_emerald',
    name: 'Tournament Emerald',
    subtitle: 'Official Championship Green & Cream',
    lightSquare: '#EEEED2',
    darkSquare: '#769656',
    borderHex: '#1F2921',
    coordLight: '#769656',
    coordDark: '#EEEED2',
    highlightMove: 'rgba(245, 246, 130, 0.58)',
    highlightLegal: 'rgba(20, 83, 45, 0.42)',
  },
  classic_walnut: {
    id: 'classic_walnut',
    name: 'Royal Walnut',
    subtitle: 'Hand-carved Burled Mahogany & Maple',
    lightSquare: '#F0D9B5',
    darkSquare: '#B58863',
    borderHex: '#3B2314',
    coordLight: '#B58863',
    coordDark: '#F0D9B5',
    highlightMove: 'rgba(255, 215, 90, 0.52)',
    highlightLegal: 'rgba(62, 39, 35, 0.45)',
  },
  obsidian_slate: {
    id: 'obsidian_slate',
    name: 'Obsidian Slate',
    subtitle: 'High-Contrast Carbon & Steel',
    lightSquare: '#CBD5E1',
    darkSquare: '#334155',
    borderHex: '#0F172A',
    coordLight: '#334155',
    coordDark: '#CBD5E1',
    highlightMove: 'rgba(56, 189, 248, 0.45)',
    highlightLegal: 'rgba(14, 165, 233, 0.45)',
  },
  arctic_ice: {
    id: 'arctic_ice',
    name: 'Arctic Glacier',
    subtitle: 'Nordic Ice Blue & Alabaster',
    lightSquare: '#F1F5F9',
    darkSquare: '#5B8FB9',
    borderHex: '#172554',
    coordLight: '#5B8FB9',
    coordDark: '#F1F5F9',
    highlightMove: 'rgba(250, 204, 21, 0.52)',
    highlightLegal: 'rgba(30, 58, 138, 0.40)',
  },
  imperial_marble: {
    id: 'imperial_marble',
    name: 'Imperial Marble',
    subtitle: 'Venetian Travertine & Bronze',
    lightSquare: '#F5F2EB',
    darkSquare: '#8C7A6B',
    borderHex: '#29221E',
    coordLight: '#8C7A6B',
    coordDark: '#F5F2EB',
    highlightMove: 'rgba(217, 119, 6, 0.45)',
    highlightLegal: 'rgba(68, 64, 60, 0.45)',
  },
};

export const PIECE_STYLES: { id: PieceStyle; name: string; subtitle: string }[] = [
  { id: 'neo_staunton', name: 'Neo-Staunton', subtitle: 'Classic Championship Silhouette' },
  { id: 'alpha_minimal', name: 'Alpha Geometric', subtitle: 'Clean Architectural Contours' },
  { id: 'imperial_royal', name: 'Imperial Crown', subtitle: 'Ornate Gold-Trimmed Filigree' },
  { id: 'cyber_vector', name: 'Tactical Vector', subtitle: 'Sharp Angular Precision' },
];

interface PieceSvgProps {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  style: PieceStyle;
  className?: string;
}

export const ChessPieceSvg: React.FC<PieceSvgProps> = ({
  type,
  color,
  style,
  className = 'w-full h-full',
}) => {
  const isWhite = color === 'w';

  // Style-specific palettes
  const getPalette = () => {
    if (style === 'imperial_royal') {
      return isWhite
        ? { fill: '#FFFBEB', stroke: '#451A03', inner: '#F59E0B', highlight: '#FFFFFF' }
        : { fill: '#1C1917', stroke: '#F59E0B', inner: '#D97706', highlight: '#44403C' };
    }
    if (style === 'cyber_vector') {
      return isWhite
        ? { fill: '#F8FAFC', stroke: '#0F172A', inner: '#10B981', highlight: '#FFFFFF' }
        : { fill: '#0F172A', stroke: '#38BDF8', inner: '#0284C7', highlight: '#1E293B' };
    }
    if (style === 'alpha_minimal') {
      return isWhite
        ? { fill: '#FFFFFF', stroke: '#1E293B', inner: '#94A3B8', highlight: '#F8FAFC' }
        : { fill: '#1E293B', stroke: '#0F172A', inner: '#64748B', highlight: '#334155' };
    }
    // default neo_staunton
    return isWhite
      ? { fill: '#F8F9FA', stroke: '#1B1D21', inner: '#CBD5E1', highlight: '#FFFFFF' }
      : { fill: '#22252A', stroke: '#0B0C0E', inner: '#525866', highlight: '#3A3F4B' };
  };

  const p = getPalette();
  const strokeWidth = style === 'cyber_vector' ? 2.2 : 2;

  return (
    <svg
      viewBox="0 0 45 45"
      className={`${className} select-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]`}
      aria-hidden="true"
    >
      {type === 'p' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {style === 'cyber_vector' ? (
            <path d="M 22.5,9 L 28,15 L 25,22 L 30,32 L 34,37 L 11,37 L 15,32 L 20,22 L 17,15 Z" />
          ) : (
            <path d="M 22.5,9 C 19.5,9 17,11.5 17,14.5 C 17,16.8 18.4,18.7 20.4,19.5 C 17.5,21.2 15.5,24.5 15.5,29 L 12,35.5 L 33,35.5 L 29.5,29 C 29.5,24.5 27.5,21.2 24.6,19.5 C 26.6,18.7 28,16.8 28,14.5 C 28,11.5 25.5,9 22.5,9 z" />
          )}
          <line x1="14" y1="33" x2="31" y2="33" stroke={p.inner} strokeWidth="1.5" />
          <circle cx="22.5" cy="14" r="2.2" fill={p.highlight} stroke="none" />
        </g>
      )}

      {type === 'r' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" />
          <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" />
          <path d="M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z" />
          <path d="M 14,16.5 L 11,14 L 34,14 L 31,16.5 L 14,16.5 z" />
          <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" />
          <line x1="15" y1="20" x2="30" y2="20" stroke={p.inner} strokeWidth="1.5" />
        </g>
      )}

      {type === 'n' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" />
          <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" />
          <circle cx="15.5" cy="14.5" r="1.5" fill={p.inner} stroke="none" />
          <line x1="15" y1="36" x2="37" y2="36" stroke={p.inner} strokeWidth="1.5" />
        </g>
      )}

      {type === 'b' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.06 9,36 9,36 z" />
          <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
          <circle cx="22.5" cy="8" r="2.2" />
          <path d="M 19.5,18 L 25.5,18 M 22.5,15 L 22.5,21" stroke={p.inner} strokeWidth="1.8" />
        </g>
      )}

      {type === 'q' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" />
          <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z" />
          <circle cx="6" cy="12" r="1.8" />
          <circle cx="14" cy="9" r="1.8" />
          <circle cx="22.5" cy="8" r="1.8" />
          <circle cx="31" cy="9" r="1.8" />
          <circle cx="39" cy="12" r="1.8" />
          <path d="M 12,33.5 C 18,32.5 27,32.5 33,33.5" stroke={p.inner} strokeWidth="1.5" />
        </g>
      )}

      {type === 'k' && (
        <g fill={p.fill} stroke={p.stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M 22.5,11.63 L 22.5,6" />
          <path d="M 20,8 L 25,8" />
          <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" />
          <path d="M 11.5,37 C 17,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 11.5,29.5 11.5,29.5 L 11.5,37 z" />
          <path d="M 11.5,30 C 17,27 27,27 32.5,30" stroke={p.inner} strokeWidth="1.5" />
          <path d="M 11.5,33.5 C 17,30.5 27,30.5 32.5,33.5" stroke={p.inner} strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
};
