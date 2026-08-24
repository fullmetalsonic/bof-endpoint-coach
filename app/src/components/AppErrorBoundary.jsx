import { Component } from "react";

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("bof_coach_ui_failure", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const ko = document.documentElement.lang !== "en";
    return <main className="app-failure" role="alert">
      <span>LOCAL UI RECOVERY</span>
      <h1>{ko ? "화면을 표시하는 중 오류가 발생했습니다." : "The screen could not be displayed."}</h1>
      <p>{ko ? "저장된 조업 데이터는 자동으로 삭제되지 않았습니다. 먼저 이 탭을 새로고침하십시오. 같은 문제가 반복되면 작업공간 초기화 대신 오류 내용과 JSON 백업을 확인하십시오." : "Saved operation data was not deleted automatically. Reload this tab first. If the problem repeats, inspect the error and your JSON backup instead of resetting the workspace."}</p>
      <code>{this.state.error?.message ?? "unknown_ui_error"}</code>
      <button type="button" onClick={() => window.location.reload()}>{ko ? "화면 새로고침" : "Reload screen"}</button>
    </main>;
  }
}
