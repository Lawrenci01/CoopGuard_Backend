import { Image, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { fonts } from '../theme';

const logo = require('../../assets/coopguard-logo.png');
const fieldGuide = require('../../assets/coopguard-field-guide-cutout.png');

export function BrandMark({ size = 42, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      accessibilityLabel="CoopGuard logo"
      resizeMode="contain"
      source={logo}
      style={[{ width: size, height: size, borderRadius: Math.round(size * 0.24) }, style]}
    />
  );
}

export function BrandLockup({
  subtitle = 'SMART POULTRY PROTECTION',
  inverse = false,
  markSize = 46,
}: {
  subtitle?: string;
  inverse?: boolean;
  markSize?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <BrandMark size={markSize} />
      <View style={{ flexShrink: 1 }}>
        <Text
          style={{
            fontFamily: fonts.bold,
            color: inverse ? '#FFFFFF' : '#1B6A42',
            fontSize: markSize >= 50 ? 21 : 15,
            letterSpacing: markSize >= 50 ? 1.7 : 1.2,
            lineHeight: markSize >= 50 ? 22 : 19,
          }}
        >
          COOPGUARD
        </Text>
        <Text
          style={{
            fontFamily: fonts.bold,
            color: inverse ? '#FFFFFFB8' : '#728078',
            fontSize: markSize >= 50 ? 8 : 9,
            letterSpacing: markSize >= 50 ? 1.45 : 0.5,
            marginTop: 3,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export function FieldGuideArtwork({
  width = 112,
  style,
}: {
  width?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessibilityLabel="CoopGuard field monitoring illustration"
      resizeMode="contain"
      source={fieldGuide}
      style={[{ width, height: width * (1589 / 989) }, style]}
    />
  );
}
