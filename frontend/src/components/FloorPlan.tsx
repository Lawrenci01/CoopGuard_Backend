import { Pressable, View, useWindowDimensions } from 'react-native';
import { Radio, Wind } from 'lucide-react-native';
import { colors } from '../theme';
import type { MetricKey, Sensor } from '../domain/types';
import { metricUnits } from '../data/fixtures';
import { en } from '../i18n/en';
import { houseGrid, sectionIndex } from '../domain/houseLayout';
import { Label } from './ui';

const displayValue = (sensor: Sensor, metric: MetricKey) => {
  if (!sensor.online) return String.fromCharCode(8212);
  const value = sensor.readings[metric];
  return `${value.toFixed(metric === 'temperature' || metric === 'ammonia' ? 1 : 0)}${
    metric === 'temperature' ? String.fromCharCode(176) : ''
  }`;
};

export function FloorPlan({
  sensors,
  metric,
  onSelect,
  lengthMetres = 90,
  widthMetres = 12,
  compact = false,
}: {
  sensors: Sensor[];
  metric: MetricKey;
  onSelect: (sensor: Sensor) => void;
  lengthMetres?: number;
  widthMetres?: number;
  compact?: boolean;
}) {
  const window = useWindowDimensions();
  const grid = houseGrid(lengthMetres, widthMetres);
  const planWidth = Math.min(Math.max(window.width - 56, 280), 760);
  // Rotate the physical plan for a phone: house length runs top-to-bottom,
  // while house width runs left-to-right.
  const displayColumns = grid.rows;
  const displayRows = grid.columns;
  const minimumCellHeight = compact ? 92 : 120;
  const maximumCellHeight = compact ? 120 : 150;
  const proportionalHeight = planWidth * (grid.lengthMetres / grid.widthMetres);
  const planHeight = Math.max(
    displayRows * minimumCellHeight,
    Math.min(proportionalHeight, displayRows * maximumCellHeight),
  );
  const markerWidth = compact ? 60 : 68;
  const markerHeight = compact ? 54 : 62;
  const innerWidth = planWidth - 24;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Label weight="bold" style={{ fontSize: 11 }}>
          {grid.lengthMetres} m × {grid.widthMetres} m
        </Label>
        <Label style={{ color: colors.muted, fontSize: 10 }}>
          {grid.count} {grid.count === 1 ? 'section' : 'sections'} · portrait view
        </Label>
      </View>

      <View
        style={{
          width: planWidth,
          marginTop: 8,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: '#CBD5CD',
          borderRadius: 16,
          paddingHorizontal: 12,
          paddingTop: 10,
          overflow: 'hidden',
        }}
      >
        <View style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Label style={{ color: '#89918B', fontSize: 8, letterSpacing: 0.7 }}>INLET</Label>
          <Wind
            size={18}
            color="#89918B"
            strokeWidth={1.7}
            style={{ transform: [{ rotate: '90deg' }] }}
          />
        </View>

        <View style={{ width: innerWidth, height: planHeight }}>
          {grid.sections.map((section) => {
            const index = sectionIndex(section);
            const houseColumn = index % grid.columns;
            const houseRow = Math.floor(index / grid.columns);
            const displayColumn = houseRow;
            const displayRow = houseColumn;
            const cellWidth = innerWidth / displayColumns;
            const cellHeight = planHeight / displayRows;
            return (
              <View
                key={section}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: displayColumn * cellWidth,
                  top: displayRow * cellHeight,
                  width: cellWidth,
                  height: cellHeight,
                  borderLeftWidth: 1,
                  borderTopWidth: 1,
                  borderRightWidth: displayColumn === displayColumns - 1 ? 1 : 0,
                  borderBottomWidth: displayRow === displayRows - 1 ? 1 : 0,
                  borderColor: '#D5DED7',
                  backgroundColor:
                    displayRow % 2 === displayColumn % 2 ? '#FBFCFB' : colors.surface,
                  padding: 8,
                }}
              >
                <Label weight="bold" style={{ color: '#7C867E', fontSize: 8, letterSpacing: 0.5 }}>
                  SECTION {section}
                </Label>
              </View>
            );
          })}

          {sensors.map((sensor) => {
            const condition = sensor.online ? sensor.conditions[metric] : 'unavailable';
            const warm = condition === 'watch' || condition === 'urgent';
            const unavailable = condition === 'unavailable';
            const color = warm ? colors.amber : unavailable ? colors.offline : colors.green;
            const fill = warm ? '#FFF5DF' : unavailable ? '#F0F1F0' : '#EDF7F0';
            const border = warm ? '#E4BD70' : unavailable ? colors.offline : '#B8D1BF';
            const displayX = Math.min(0.96, Math.max(0.04, sensor.y));
            const displayY = Math.min(0.98, Math.max(0.02, sensor.x));
            return (
              <Pressable
                key={sensor.id}
                testID={`map-${sensor.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${en.sensor} ${sensor.number}, ${en.section} ${sensor.section}, ${
                  sensor.online
                    ? `${sensor.readings[metric].toFixed(
                        metric === 'temperature' || metric === 'ammonia' ? 1 : 0,
                      )} ${metricUnits[metric]}`
                    : en.offline
                }`}
                onPress={() => onSelect(sensor)}
                style={({ pressed }) => ({
                  position: 'absolute',
                  left: displayX * innerWidth - markerWidth / 2,
                  top: displayY * planHeight - markerHeight / 2,
                  width: markerWidth,
                  minHeight: markerHeight,
                  borderRadius: 13,
                  borderWidth: 1,
                  borderStyle: unavailable ? 'dashed' : 'solid',
                  borderColor: border,
                  backgroundColor: fill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    position: 'absolute',
                    top: -9,
                    width: 23,
                    height: 23,
                    borderRadius: 12,
                    borderWidth: 3,
                    borderColor: colors.surface,
                    backgroundColor: color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Radio size={13} color="#FFFFFF" strokeWidth={1.8} />
                </View>
                <Label weight="bold" style={{ color, fontSize: 15, lineHeight: 19 }}>
                  {displayValue(sensor, metric)}
                </Label>
                <Label style={{ color, fontSize: 7 }} numberOfLines={1}>
                  {sensor.id}
                </Label>
              </Pressable>
            );
          })}
        </View>

        <View style={{ minHeight: 35, alignItems: 'center', justifyContent: 'center' }}>
          <Label style={{ color: '#89918B', fontSize: 8, letterSpacing: 0.7 }}>EXHAUST</Label>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingVertical: 13,
        }}
      >
        {[
          [colors.green, 'Reporting'],
          [colors.amber, 'Attention'],
          [colors.offline, 'Saved / offline'],
        ].map(([color, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
            <Label style={{ color: colors.muted, fontSize: 8 }}>{label}</Label>
          </View>
        ))}
      </View>
    </View>
  );
}
