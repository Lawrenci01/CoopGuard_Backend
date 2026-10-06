import React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { summarizeReadings } from '../domain/readings';
import { colors } from '../theme';
import type { MetricKey, Sensor } from '../domain/types';
import { metricUnits } from '../data/fixtures';
import { en } from '../i18n/en';
import { Chip, Label } from './ui';

export function FloorPlan({
  sensors,
  metric,
  onSelect,
  compact = false,
}: {
  sensors: Sensor[];
  metric: MetricKey;
  onSelect: (sensor: Sensor) => void;
  compact?: boolean;
}) {
  const { width } = useWindowDimensions();
  const small = width < 600;
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        {(['A', 'B', 'C'] as const).map((section) => {
          const summary = summarizeReadings(
            sensors.filter((sensor) => sensor.section === section),
            metric,
          );
          return (
            <View key={section} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
              <Label weight="bold" style={{ fontSize: 12 }}>
                {en.section} {section}
              </Label>
              {!compact && (
                <Chip
                  tone={
                    summary.condition === 'urgent'
                      ? 'red'
                      : summary.condition === 'watch'
                        ? 'amber'
                        : summary.condition === 'unavailable' ||
                            summary.condition === 'unclassified'
                          ? 'muted'
                          : 'green'
                  }
                >
                  {summary.condition === 'unavailable'
                    ? en.incompleteReadings
                    : en.statuses[summary.condition]}
                </Chip>
              )}
            </View>
          );
        })}
      </View>
      <View style={{ height: compact ? 180 : small ? 250 : 270 }}>
        <Svg width="100%" height="100%" viewBox="0 0 900 260" preserveAspectRatio="none">
          <Path
            d="M 22 35 L 50 15 H 850 L 878 35 V 225 L 850 245 H 50 L 22 225 Z"
            fill="#F5F7F0"
            stroke="#B8C8B4"
            strokeWidth="2"
          />
          <Rect
            x="305"
            y="17"
            width="290"
            height="226"
            fill={metric === 'temperature' ? '#FAEED9' : '#EDF3E9'}
          />
          <Line x1="303" x2="303" y1="17" y2="243" stroke="#C7D1C2" strokeDasharray="6 6" />
          <Line x1="597" x2="597" y1="17" y2="243" stroke="#C7D1C2" strokeDasharray="6 6" />
          <Line
            x1="25"
            x2="875"
            y1="130"
            y2="130"
            stroke="#D7DFD0"
            strokeWidth="1"
            strokeDasharray="4 7"
          />
          {[90, 210, 360, 490, 650, 770].map((x) => (
            <React.Fragment key={x}>
              <Rect x={x} y="10" width="50" height="9" fill="#E2E9DB" stroke="#B8C8B4" />
              <Rect x={x} y="241" width="50" height="9" fill="#E2E9DB" stroke="#B8C8B4" />
            </React.Fragment>
          ))}
        </Svg>
        {sensors.map((sensor) => {
          const condition = sensor.online ? sensor.conditions[metric] : 'unavailable';
          const color =
            condition === 'urgent'
              ? colors.red
              : condition === 'watch'
                ? colors.amber
                : condition === 'good'
                  ? colors.green
                  : colors.muted;
          const fill =
            condition === 'urgent'
              ? colors.redSoft
              : condition === 'watch'
                ? colors.amberSoft
                : condition === 'good'
                  ? colors.greenSoft
                  : '#F6F7F2';
          return (
            <Pressable
              key={sensor.id}
              testID={`map-${sensor.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${en.sensor} ${sensor.number}, ${en.section} ${sensor.section}, ${sensor.online ? `${sensor.readings[metric].toFixed(metric === 'temperature' || metric === 'ammonia' ? 1 : 0)} ${metricUnits[metric]}` : en.offline}`}
              onPress={() => onSelect(sensor)}
              style={({ pressed }) => [
                {
                  position: 'absolute',
                  left: `${sensor.x * 100}%`,
                  top: `${sensor.y * 100}%`,
                  width: small ? 46 : 62,
                  minHeight: 52,
                  marginLeft: small ? -23 : -31,
                  marginTop: -26,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  transform: [{ scale: pressed ? 1.1 : 1 }],
                },
              ]}
            >
              <View
                style={{
                  width: 25,
                  height: 25,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderStyle: sensor.online ? 'solid' : 'dashed',
                  borderColor: color,
                  backgroundColor: fill,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 5,
                    backgroundColor: color,
                  }}
                />
              </View>
              <Label
                weight="bold"
                style={{
                  fontSize: small ? 10 : 12,
                  lineHeight: 15,
                  color,
                }}
              >
                {sensor.online
                  ? `${sensor.readings[metric].toFixed(metric === 'temperature' || metric === 'ammonia' ? 1 : 0)}${metric === 'temperature' ? '°' : ''}`
                  : '—'}
              </Label>
            </Pressable>
          );
        })}
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
          marginTop: 16,
        }}
      >
        <Chip tone="green" dot>
          {en.statuses.good}
        </Chip>
        <Chip tone="amber" dot>
          {en.statuses.watch}
        </Chip>
        {sensors.some((s) => s.online && s.conditions[metric] === 'urgent') && (
          <Chip tone="red" dot>
            {en.statuses.urgent}
          </Chip>
        )}
        <Chip tone="muted" dot>
          {en.statuses.unavailable}
        </Chip>
        {sensors.some((s) => s.online && s.conditions[metric] === 'unclassified') && (
          <Chip tone="muted" dot>
            {en.statuses.unclassified}
          </Chip>
        )}
      </View>
    </View>
  );
}
