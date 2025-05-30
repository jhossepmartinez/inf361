export type Sensor = {
  type: SensorType;
  measurement: Measurement;
};

type SensorType =
  | "air_quality"
  | "gas"
  | "fire"
  | "noise"
  | "humidity"
  | "door_window";

type Measurement =
  | AirQualityMeasurement
  | GasMeasurement
  | FireMeasurement
  | NoiseMeasurement
  | HumidityMeasurement
  | DoorWindowMeasurement;

type AirQualityMeasurement = {
  type: "co2";
  value: number;
};

type GasMeasurement = {
  type: "methane";
  value: number;
};

type FireMeasurement = {
  type: "temperature";
  value: number;
};

type NoiseMeasurement = {
  type: "db_level";
  value: number;
};

type HumidityMeasurement = {
  type: "relative_humidity";
  value: number;
};

type DoorWindowMeasurement = {
  type: "open_status";
  value: boolean;
};
