import React, { useEffect, useId, useState } from 'react';
import { Pressable, View } from 'react-native';
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
import { Label } from './ui';

export interface TrendPoint {
  sampledAt: number;
  value: number;
}

export function TrendChart({
  points,
  unit,
  precision,
  axisLabels,
  formatTimestamp,
}: {
  points: TrendPoint[];
  unit: string;
  precision: number;
  axisLabels: string[];
  formatTimestamp: (sampledAt: number) => string;
}) {
  const id = useId().replace(/:/g, '');
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, points.length - 1));
  const [layoutWidth, setLayoutWidth] = useState(430);

  useEffect(() => setSelectedIndex(Math.max(0, points.length - 1)), [points]);

  const rawMin = Math.min(...points.map((point) => point.value));
  const rawMax = Math.max(...points.map((point) => point.value));
  const padding = Math.max((rawMax - rawMin) * 0.14, precision ? 0.5 : 1);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const left = 45;
  const right = 420;
  const top = 16;
  const bottom = 158;
  const chartPoints = points.map((point, index) => ({
    x: left + (index / Math.max(points.length - 1, 1)) * (right - left),
    y: bottom - ((point.value - min) / Math.max(max - min, 1)) * (bottom - top),
  }));
  const first = chartPoints[0]!;
  const last = chartPoints[chartPoints.length - 1]!;
  const path = chartPoints
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = chartPoints[index - 1]!;
      return `C ${(previous.x + point.x) / 2} ${previous.y}, ${(previous.x + point.x) / 2} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(' ');
  const selected = points[selectedIndex] ?? points[points.length - 1]!;
  const selectedChartPoint = chartPoints[selectedIndex] ?? last;

  const selectAt = (locationX: number) => {
    const plotLeft = (left / 430) * layoutWidth;
    const plotRight = (right / 430) * layoutWidth;
    const ratio = Math.min(1, Math.max(0, (locationX - plotLeft) / (plotRight - plotLeft)));
    setSelectedIndex(Math.round(ratio * Math.max(0, points.length - 1)));
  };

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={`Environmental history. Selected ${selected.value.toFixed(precision)} ${unit}, ${formatTimestamp(selected.sampledAt)}.`}
        accessibilityHint="Tap a position on the chart to inspect its reading."
        onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
        onPress={(event) => selectAt(event.nativeEvent.locationX)}
        style={({ pressed }) => ({ height: 205, opacity: pressed ? 0.96 : 1 })}
      >
        <Svg width="100%" height="100%" viewBox="0 0 430 205" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.green} stopOpacity="0.24" />
              <Stop offset="1" stopColor={colors.green} stopOpacity="0.015" />
            </LinearGradient>
          </Defs>
          {[0, 1, 2, 3].map((index) => {
            const y = top + (index / 3) * (bottom - top);
            return (
              <React.Fragment key={index}>
                <Line
                  x1={left}
                  x2={right}
                  y1={y}
                  y2={y}
                  stroke={colors.border}
                  strokeDasharray="3 5"
                />
                <SvgText
                  x="38"
                  y={y + 4}
                  textAnchor="end"
                  fill={colors.muted}
                  fontSize="9"
                  fontFamily={fonts.regular}
                >
                  {(max - (index / 3) * (max - min)).toFixed(precision)}
                </SvgText>
              </React.Fragment>
            );
          })}
          <Path d={`${path} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`} fill={`url(#${id})`} />
          <Path
            d={path}
            fill="none"
            stroke={colors.green}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <Line
            x1={selectedChartPoint.x}
            x2={selectedChartPoint.x}
            y1={top}
            y2={bottom}
            stroke={colors.green}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.72"
          />
          <Circle
            cx={selectedChartPoint.x}
            cy={selectedChartPoint.y}
            r="6"
            fill={colors.green}
            stroke="white"
            strokeWidth="3"
          />
          {axisLabels.map((label, index) => (
            <SvgText
              key={`${label}-${index}`}
              x={left + (index / Math.max(axisLabels.length - 1, 1)) * (right - left)}
              y="194"
              textAnchor={
                index === 0 ? 'start' : index === axisLabels.length - 1 ? 'end' : 'middle'
              }
              fontSize="9"
              fill={colors.muted}
              fontFamily={fonts.regular}
            >
              {label}
            </SvgText>
          ))}
        </Svg>
      </Pressable>

      <View
        style={{
          minHeight: 58,
          borderRadius: 13,
          backgroundColor: colors.greenSoft,
          borderWidth: 1,
          borderColor: '#D7E6DB',
          paddingHorizontal: 13,
          paddingVertical: 9,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Label weight="bold" style={{ fontSize: 11, color: colors.green }}>
            Selected whole-house average
          </Label>
          <Label style={{ color: colors.muted, fontSize: 10 }}>
            {formatTimestamp(selected.sampledAt)}
          </Label>
        </View>
        <Label weight="bold" style={{ color: colors.green, fontSize: 20, lineHeight: 26 }}>
          {selected.value.toFixed(precision)} {unit}
        </Label>
      </View>
      <Label style={{ color: colors.muted, fontSize: 10, textAlign: 'center' }}>
        Tap anywhere on the graph to inspect the closest stored time window.
      </Label>
    </View>
  );
}
