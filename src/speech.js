export const LOCAL_SPEECH = {
  supported: false,
  reason: "Voice input is off. This version does not include an on-device speech model, and it will not send your voice to a server or use the browser's dictation service.",
};

export function speechSendsAudio() {
  return false;
}
