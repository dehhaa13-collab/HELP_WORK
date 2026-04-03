/* ============================================
   ErrorBoundary — Защита от краша вкладок
   Изолирует ошибку в одном компоненте, 
   остальной интерфейс продолжает работать.
   ============================================ */

import { Component, type ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  /** Название секции для отображения в ошибке */
  section?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.section ? `: ${this.props.section}` : ''}]`,
      error,
      info.componentStack
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-icon">😵</div>
          <h3 className="error-boundary-title">
            {this.props.section
              ? `Ошибка в "${this.props.section}"`
              : 'Что-то пошло не так'}
          </h3>
          <p className="error-boundary-message">
            {this.state.error?.message || 'Неизвестная ошибка'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            🔄 Попробовать ещё раз
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
