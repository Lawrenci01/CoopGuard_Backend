import { beforeEach, describe, expect, test } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { en } from '../src/i18n/en';
import { LOCAL_FARM_KEY } from '../src/services/localFarmRepository';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('native mobile flows', () => {
  test('adding a sensor creates a persisted device and notes save from the AI panel', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByTestId('enter-demo'));
    await fireEvent.press(await screen.findByTestId('preview-settings'));
    await fireEvent.press(screen.getByTestId('role-technician'));
    await fireEvent.press(screen.getAllByLabelText(en.close).at(-1)!);
    await fireEvent.press(screen.getByTestId('nav-Devices'));
    await fireEvent.press(await screen.findByTestId('add-sensor'));
    await fireEvent.press(screen.getByText(en.sampleScan));
    for (let step = 0; step < 4; step++) await fireEvent.press(screen.getByText(en.continue));
    await fireEvent.press(screen.getByText(en.calibrationDemo));
    await fireEvent.press(screen.getByText(en.continue));
    await fireEvent.press(screen.getByText(en.finishPreview));
    await screen.findByText(en.finishTitle);
    await fireEvent.press(screen.getByText(en.done));
    expect(screen.getByTestId('device-sensor-13')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem(LOCAL_FARM_KEY))!).snapshot.sensors).toHaveLength(
      13,
    );
    await fireEvent.press(screen.getByTestId('nav-Analytics'));
    await fireEvent.press(screen.getAllByText(en.aiAbout).at(-1)!);
    await fireEvent.changeText(
      screen.getByLabelText('What did you notice?'),
      'Birds settled after feeding.',
    );
    await fireEvent.press(screen.getByTestId('save-inspection'));
    await waitFor(() => expect(screen.getByText('Birds settled after feeding.')).toBeTruthy());
    expect(JSON.parse((await AsyncStorage.getItem(LOCAL_FARM_KEY))!).inspections[0].text).toBe(
      'Birds settled after feeding.',
    );
  }, 20000);

  test('welcome opens all five screens and acknowledges an alert without resolving it', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByTestId('enter-demo'));
    await screen.findByTestId('screen-Dashboard');
    await fireEvent.press(screen.getByTestId('nav-Alerts'));
    await fireEvent.press(await screen.findByTestId('ack-heat-b'));
    await waitFor(() =>
      expect(screen.getByTestId('ack-heat-b').props.accessibilityState.disabled).toBe(true),
    );
    expect(screen.getByText(en.heatAlert)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nav-Heat-Map'));
    await screen.findByTestId('screen-Heat-Map');
    await fireEvent.press(screen.getByTestId('layer-humidity'));
    await fireEvent.press(screen.getByTestId('map-sensor-11'));
    await screen.findByText(en.missingReading);
    await fireEvent.press(screen.getAllByLabelText(en.close).at(-1)!);
    await fireEvent.press(screen.getByTestId('nav-Analytics'));
    await screen.findByText(en.environmentAI);
    expect(screen.getByText(en.soundAI)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nav-Devices'));
    await screen.findByTestId('screen-Devices');
    await fireEvent.changeText(screen.getByLabelText(en.searchSensors), '11');
    expect(screen.getByTestId('device-sensor-11')).toBeTruthy();
    expect(screen.queryByTestId('device-sensor-01')).toBeNull();
  }, 20000);

  test('reopening restores saved acknowledgments and stays usable without a server', async () => {
    const app = await render(<App />);
    await fireEvent.press(await screen.findByTestId('enter-demo'));
    await fireEvent.press(await screen.findByTestId('nav-Alerts'));
    await fireEvent.press(await screen.findByTestId('ack-heat-b'));
    await waitFor(() =>
      expect(screen.getByTestId('ack-heat-b').props.accessibilityState.disabled).toBe(true),
    );
    await waitFor(async () => expect(await AsyncStorage.getItem(LOCAL_FARM_KEY)).not.toBeNull());
    await app.unmount();
    await render(<App />);
    await screen.findByText(en.connection.local);
    expect(screen.getByTestId('full-power').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId('nav-Alerts'));
    expect(screen.getByTestId('ack-heat-b').props.accessibilityState.disabled).toBe(true);
  });

  test('house setup validates inputs and saves an existing-controller draft as monitor-only advice', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByTestId('start-setup'));
    await fireEvent.press(screen.getByText(en.reviewDraft));
    expect(screen.getByText(en.setupInvalid)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(en.farmLabel), 'Test farm');
    await fireEvent.changeText(screen.getByLabelText(en.houseLabel), 'West house');
    await fireEvent.changeText(screen.getByLabelText(en.lengthLabel), '90');
    await fireEvent.changeText(screen.getByLabelText(en.widthLabel), '12');
    await fireEvent.press(screen.getByText(en.controllerOptions.present));
    await fireEvent.press(screen.getByText(en.reviewDraft));
    expect(screen.getByText(en.surveyOutcome.monitor)).toBeTruthy();
    await fireEvent.press(screen.getByText(en.saveDraft));
    await screen.findByTestId('enter-demo');
    const draft = JSON.parse((await AsyncStorage.getItem(LOCAL_FARM_KEY))!).house;
    expect(draft.controller).toBe('present');
    expect(draft.houseType).toBe('unknown');
  });
});
