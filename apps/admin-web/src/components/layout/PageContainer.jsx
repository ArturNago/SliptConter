import React from 'react';
import Header from './Header';

export default function PageContainer({ title, children, hideHeader }) {
  return (
    <div className="main-content" style={{ marginLeft: 0, flex: 1 }}>
      {!hideHeader && <Header title={title} />}
      <div className="page-container">{children}</div>
    </div>
  );
}
