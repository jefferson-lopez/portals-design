type PasswordVisibilityLabels = {
  hide: string;
  show: string;
};

export function getPasswordVisibilityState(
  visible: boolean,
  labels: PasswordVisibilityLabels,
) {
  return {
    buttonLabel: visible ? labels.hide : labels.show,
    inputType: visible ? ("text" as const) : ("password" as const),
  };
}
