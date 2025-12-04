import React from 'react';
import Svg, { Path, Rect, Line, Circle, Polyline, Defs, Mask } from 'react-native-svg';

export const PharmacyIcon = ({ size = 20, color = '#FF4509' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 3h18v18H3z" />
    <Path d="M3 9h18" />
    <Path d="M9 21V9" />
  </Svg>
);

export const GroupViewIcon = ({ size = 20, color = '#FF4509' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="7" height="7" />
    <Rect x="14" y="3" width="7" height="7" />
    <Rect x="14" y="14" width="7" height="7" />
    <Rect x="3" y="14" width="7" height="7" />
  </Svg>
);

export const CalendarIcon = ({ size = 20, color = '#FF4509' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

export const DollarIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="12" y1="1" x2="12" y2="23" />
    <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </Svg>
);

export const TargetIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2v20M2 12h20" />
    <Circle cx="12" cy="12" r="10" />
  </Svg>
);

export const GPIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </Svg>
);

export const BasketIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <Line x1="7" y1="7" x2="7.01" y2="7" />
  </Svg>
);

export const ShoppingCartIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="9" cy="21" r="1" />
    <Circle cx="20" cy="21" r="1" />
    <Path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </Svg>
);

export const HamburgerIcon = ({ size = 24, color = '#1F2937' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="3" y1="6" x2="21" y2="6" />
    <Line x1="3" y1="12" x2="21" y2="12" />
    <Line x1="3" y1="18" x2="21" y2="18" />
  </Svg>
);

export const BuildingIcon = ({ size = 20, color = '#FF4509' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 21h18" />
    <Path d="M5 21V7l8-4v18" />
    <Path d="M19 21V11l-6-4" />
    <Line x1="9" y1="9" x2="9" y2="9" />
    <Line x1="9" y1="12" x2="9" y2="12" />
    <Line x1="9" y1="15" x2="9" y2="15" />
    <Line x1="9" y1="18" x2="9" y2="18" />
  </Svg>
);

export const DashboardIcon = ({ size = 20, color = '#6B7280' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="7" height="7" />
    <Rect x="14" y="3" width="7" height="7" />
    <Rect x="14" y="14" width="7" height="7" />
    <Rect x="3" y="14" width="7" height="7" />
  </Svg>
);

export const DailySummaryIcon = ({ size = 20, color = '#6B7280' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

export const StockManagementIcon = ({ size = 20, color = '#6B7280' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <Polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <Line x1="12" y1="22.08" x2="12" y2="12" />
  </Svg>
);

export const SearchIcon = ({ size = 20, color = '#6B7280' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="8" />
    <Path d="m21 21-4.35-4.35" />
  </Svg>
);

export const UsersIcon = ({ size = 20, color = '#6B7280' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Circle cx="9" cy="7" r="4" />
    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

export const TrendingUpIcon = ({ size = 20, color = '#6B7280' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 11H5a2 2 0 0 0-2 2v3c0 1.1.9 2 2 2h4m0-7h10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H9m0-7V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </Svg>
);

export const TargetIconNav = ({ size = 20, color = '#6B7280' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Circle cx="12" cy="12" r="6" />
    <Circle cx="12" cy="12" r="2" />
  </Svg>
);

export const SplitIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2L2 7l10 5 10-5-10-5z" />
    <Path d="M2 17l10 5 10-5" />
    <Path d="M2 12l10 5 10-5" />
  </Svg>
);

export const ScriptsIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Polyline points="14,2 14,8 20,8" />
    <Line x1="16" y1="13" x2="8" y2="13" />
    <Line x1="16" y1="17" x2="8" y2="17" />
    <Polyline points="10,9 9,9 8,9" />
  </Svg>
);

export const BestSellersIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </Svg>
);

export const WarningIcon = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <Line x1="12" y1="9" x2="12" y2="13" />
    <Line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
);

export const DailyIcon = ({ size = 28, color = '#221f20' }) => {
  // Calculate aspect ratio to maintain proportions
  const aspectRatio = 433.26 / 277.88;
  const width = size * aspectRatio;
  const height = size;
  
  return (
    <Svg width={width} height={height} viewBox="0 0 433.26 277.88">
      <Path
        d="M296.87,28.04h-160.47c-16.94,0-30.67,13.73-30.67,30.67v160.47c0,16.94,13.73,30.67,30.67,30.67h160.47c16.94,0,30.67-13.73,30.67-30.67V58.7c0-16.94-13.73-30.67-30.67-30.67ZM303.64,210.68c0,9.81-7.95,17.76-17.76,17.76h-138.5c-9.81,0-17.76-7.95-17.76-17.76v-75.38c0-9.81,7.95-17.76,17.76-17.76h138.5c9.81,0,17.76,7.95,17.76,17.76v75.38Z"
        fill={color}
      />
    </Svg>
  );
};

export const MonthlyIcon = ({ size = 28, color = '#221f20' }) => {
  // Calculate aspect ratio to maintain proportions
  const aspectRatio = 433.26 / 277.88;
  const width = size * aspectRatio;
  const height = size;
  
  return (
    <Svg width={width} height={height} viewBox="0 0 433.26 277.88">
      <Path
        d="M296.87,28.04h-160.47c-16.94,0-30.67,13.73-30.67,30.67v160.47c0,16.94,13.73,30.67,30.67,30.67h160.47c16.94,0,30.67-13.73,30.67-30.67V58.7c0-16.94-13.73-30.67-30.67-30.67ZM303.64,210.68c0,9.81-7.95,17.76-17.76,17.76h-138.5c-9.81,0-17.76-7.95-17.76-17.76v-75.38c0-9.81,7.95-17.76,17.76-17.76h138.5c9.81,0,17.76,7.95,17.76,17.76v75.38Z"
        fill={color}
      />
      <Path
        d="M96.26,209.14h-41.88c-7.81,0-14.14-6.33-14.14-14.14v-60.01c0-7.81,6.33-14.14,14.14-14.14h41.88V49.6h-50.62c-13.48,0-24.41,10.93-24.41,24.41v127.75c0,13.48,10.93,24.41,24.41,24.41h50.62v-17.04Z"
        fill={color}
      />
      <Path
        d="M337.01,210.19h41.88c7.81,0,14.14-6.33,14.14-14.14v-60.01c0-7.81-6.33-14.14-14.14-14.14h-41.88V50.65h50.62c13.48,0,24.41,10.93,24.41,24.41v127.75c0,13.48-10.93,24.41-24.41,24.41h-50.62v-17.04Z"
        fill={color}
      />
    </Svg>
  );
};

export const ListIcon = ({ size = 16, color = '#1F2937' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="8" y1="6" x2="21" y2="6" />
    <Line x1="8" y1="12" x2="21" y2="12" />
    <Line x1="8" y1="18" x2="21" y2="18" />
    <Line x1="3" y1="6" x2="3.01" y2="6" />
    <Line x1="3" y1="12" x2="3.01" y2="12" />
    <Line x1="3" y1="18" x2="3.01" y2="18" />
  </Svg>
);

export const DownloadIcon = ({ size = 20, color = '#1F2937' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Polyline points="7 10 12 15 17 10" />
    <Line x1="12" y1="15" x2="12" y2="3" />
  </Svg>
);

export const BackArrowIcon = ({ size = 24, color = '#1F2937' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="19" y1="12" x2="5" y2="12" />
    <Polyline points="12 19 5 12 12 5" />
  </Svg>
);

export const TrendIcon = ({ size = 16, color = '#1F2937' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
    <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
  </Svg>
);

export const ChevronDownIcon = ({ size = 20, color = '#1F2937' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="6 9 12 15 18 9" />
  </Svg>
);

export const ChevronRightIcon = ({ size = 20, color = '#1F2937' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="9 18 15 12 9 6" />
  </Svg>
);

export const ClockIcon = ({ size = 20, color = '#1F2937' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);

