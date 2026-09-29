import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors, fonts } from '../theme';
import { en } from '../i18n/en';

export function TrendChart({
  values,
  compact = false,
  labels = en.chartLabels.today,
}: {
  values: number[];
  compact?: boolean;
  labels?: string[];
}) {
  const id = useId().replace(/:/g, '');
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const left = compact ? 0 : 36,
    right = compact ? 420 : 415,
    top = compact ? 5 : 16,
    bottom = compact ? 48 : 155;
  const points = values.map((value, i) => ({
    x: left + (i / Math.max(values.length - 1, 1)) * (right - left),
    y: bottom - ((value - min) / (max - min)) * (bottom - top),
  }));
  const first = points[0]!,
    last = points[points.length - 1]!;
  const path = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1]!;
      return `C ${(prev.x + p.x) / 2} ${prev.y}, ${(prev.x + p.x) / 2} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(' ');
  return (
    <View
      accessibilityLabel={compact ? undefined : en.chartDescription}
      style={{ height: compact ? 52 : 192, width: '100%' }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 430 ${compact ? 52 : 192}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#C9DDAD" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#E7EEDC" stopOpacity="0.08" />
          </LinearGradient>
        </Defs>
        {!compact &&
          [0, 1, 2, 3].map((i) => {
            const y = top + (i / 3) * (bottom - top);
            return (
              <React.Fragment key={i}>
                <Line
                  x1={left}
                  x2={right}
                  y1={y}
                  y2={y}
                  stroke={colors.border}
                  strokeDasharray="3 5"
                />
                <SvgText
                  x="0"
                  y={y + 4}
                  fill={colors.muted}
                  fontSize="10"
                  fontFamily={fonts.regular}
                >
                  {Math.round(max - (i / 3) * (max - min))}
                </SvgText>
              </React.Fragment>
            );
          })}
        <Path d={`${path} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`} fill={`url(#${id})`} />
        <Path
          d={path}
          fill="none"
          stroke={colors.green}
          strokeWidth={compact ? 2 : 2.5}
          strokeLinecap="round"
        />
        {!compact && (
          <>
            <Circle
              cx={last.x}
              cy={last.y}
              r="5"
              fill={colors.green}
              stroke="white"
              strokeWidth="2"
            />
            {labels.map((label, i) => (
              <SvgText
                key={label}
                x={left + (i / (labels.length - 1)) * (right - left)}
                y="184"
                textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
                fontSize="10"
                fill={colors.muted}
                fontFamily={fonts.regular}
              >
                {label}
              </SvgText>
            ))}
          </>
        )}
      </Svg>
    </View>
  );
}
