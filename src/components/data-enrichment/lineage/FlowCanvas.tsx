'use client'

import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { FlowMapResponse } from './utils/transform'
import { useFlowLayout } from './hooks/useFlowLayout'
import { EntityNode } from './nodes/EntityNode'
import { SourceNode } from './nodes/SourceNode'
import { FieldGroupNode } from './nodes/FieldGroupNode'
import { MappingEdge } from './edges/MappingEdge'
import { ReferenceEdge } from './edges/ReferenceEdge'
import { FlowLegend } from './panels/FlowLegend'

const nodeTypes = {
  entityNode: EntityNode,
  sourceNode: SourceNode,
  fieldGroupNode: FieldGroupNode,
}

const edgeTypes = {
  mappingEdge: MappingEdge,
  referenceEdge: ReferenceEdge,
}

interface FlowCanvasProps {
  data: FlowMapResponse
}

/**
 * Desktop React Flow canvas for the Data Flow Map.
 * Shows entity nodes, source nodes, and edges in a pan/zoom canvas.
 */
export function FlowCanvas({ data }: FlowCanvasProps) {
  const { nodes: layoutNodes, edges: layoutEdges } = useFlowLayout(data)

  return (
    <div className="relative w-full h-[calc(100vh-8rem)] rounded-xl border bg-background overflow-hidden">
      <ReactFlow
        nodes={layoutNodes}
        edges={layoutEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          maxZoom: 1.5,
        }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'bezier',
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="!bg-muted/20"
        />
        <Controls
          showInteractive={false}
          className="!bg-card !border !rounded-lg !shadow-sm"
        />
        <MiniMap
          nodeStrokeWidth={3}
          className="!bg-card !border !rounded-lg !shadow-sm"
          maskColor="rgba(0,0,0,0.08)"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 z-10 w-48">
        <FlowLegend />
      </div>
    </div>
  )
}
