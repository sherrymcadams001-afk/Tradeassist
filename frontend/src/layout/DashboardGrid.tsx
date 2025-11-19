import { ReactNode } from "react";
import GridLayout, { Layout } from "react-grid-layout";

import { palette } from "../theme/palette";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type DashboardGridProps = {
  layout: Layout[];
  onLayoutChange?: (layout: Layout[]) => void;
  children: ReactNode;
};

export function DashboardGrid({ layout, onLayoutChange, children }: DashboardGridProps) {
  return (
    <div
      style={{
        backgroundColor: palette.background.base,
        minHeight: "100vh",
        color: palette.text.primary,
        fontFamily: palette.typography.mono,
        padding: "16px",
      }}
    >
      <GridLayout
        className="veridian-grid"
        cols={12}
        rowHeight={32}
        width={1440}
        margin={[8, 8]}
        compactType={null}
        preventCollision
        onLayoutChange={onLayoutChange}
        layout={layout}
      >
        {children}
      </GridLayout>
    </div>
  );
}
