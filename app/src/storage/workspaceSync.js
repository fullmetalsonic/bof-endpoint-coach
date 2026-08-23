const CHANNEL_NAME = "bof-endpoint-coach-workspace";

export function createWorkspaceSync(onMessage) {
  if (typeof BroadcastChannel === "undefined") {
    return { publish() {}, close() {} };
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event) => onMessage?.(event.data);
  return {
    publish(message) {
      channel.postMessage(message);
    },
    close() {
      channel.close();
    },
  };
}
