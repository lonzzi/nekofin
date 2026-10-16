export type ServerFormValues = {
  address: string;
  port: string;
  path: string;
  username: string;
  password: string;
  name: string;
  note: string;
};

export type NativeServerFormProps = {
  values: ServerFormValues;
  onChange: (field: keyof ServerFormValues, value: string) => void;
  busy: boolean;
  error: string;
};

export function NativeServerForm(_props: NativeServerFormProps) {
  return null;
}
