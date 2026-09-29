import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

export function BarnIllustration() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 290 190" accessibilityElementsHidden>
      <Circle cx="217" cy="48" r="25" fill="#E5D68D" opacity="0.65" />
      <Path d="M14 163 Q72 134 149 151 T283 158 V180 H14Z" fill="#D1DDBB" />
      <Path d="M47 89 L131 40 L252 83 L170 124 Z" fill="#709071" stroke="#526F54" strokeWidth="2" />
      <Path d="M47 89 L170 124 V163 L47 132Z" fill="#E5EBD5" stroke="#78906F" strokeWidth="2" />
      <Path d="M170 124 L252 83 V133 L170 163Z" fill="#BECEA9" stroke="#78906F" strokeWidth="2" />
      {[71, 95, 119, 143].map((x) => (
        <Path
          key={x}
          d={`M${x} ${97 + (x - 71) * 0.28} v22 l-14 -4 v-22Z`}
          fill="#6A8766"
          opacity="0.8"
        />
      ))}
      <Path d="M198 149 V116 L220 106 V138" fill="#66865F" />
      <Path
        d="M50 88 L132 45 M73 94 L150 51 M99 101 L173 59 M125 109 L199 69 M151 116 L227 77"
        stroke="#A5BA8D"
        strokeWidth="2"
      />
      <Path
        d="M27 147 v-39 M27 129 q-20 -1 -17 -17 q19 0 17 17 M27 119 q17 -5 15 -18 q-18 4 -15 18"
        fill="#7D9B62"
        stroke="#63834F"
        strokeWidth="2"
      />
      <Path
        d="M266 150 v-34 M266 137 q-14 -3 -12 -15 q14 0 12 15 M266 126 q13 -2 12 -14 q-13 2 -12 14"
        fill="#7D9B62"
        stroke="#63834F"
        strokeWidth="2"
      />
      <Ellipse cx="113" cy="153" rx="10" ry="7" fill="#FCFCF1" />
      <Circle cx="122" cy="145" r="5" fill="#FCFCF1" />
      <Path d="M127 145 l5 2 -5 2Z" fill="#C7A26A" />
      <Line x1="109" x2="109" y1="158" y2="164" stroke="#A48850" />
      <Line x1="116" x2="116" y1="158" y2="164" stroke="#A48850" />
      <Ellipse cx="89" cy="164" rx="8" ry="6" fill="#FCFCF1" />
      <Circle cx="97" cy="157" r="4" fill="#FCFCF1" />
      <Path d="M101 157 l4 2 -4 1Z" fill="#C7A26A" />
    </Svg>
  );
}
