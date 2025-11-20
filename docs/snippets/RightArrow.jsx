export const RightArrow = ({ children }) => (
  <div>
    <span style={{ position: 'absolute', top: 'calc(50% - 12px)', right: 20, opacity: .5 }}>
      <Icon icon="chevron-right" size={24} />
    </span>
    {children}
  </div>);