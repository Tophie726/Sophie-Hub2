'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Line, Circle, Rect, Text, Transformer } from 'react-konva'
import Konva from 'konva'
import {
  ZoomIn,
  ZoomOut,
  Pencil,
  Square,
  Circle as CircleIcon,
  Type,
  Trash2,
  RotateCcw,
  Move,
  MousePointer2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DrawingTool = 'select' | 'pen' | 'rectangle' | 'circle' | 'text' | 'pan' | null

interface DrawingElement {
  id: string
  type: 'line' | 'rectangle' | 'circle' | 'text'
  points?: number[]
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  text?: string
  color: string
}

interface ScreenshotEditorProps {
  imageUrl: string
  onSave: (editedImageUrl: string) => void
  onCancel: () => void
}

// Refined color palette - more subtle
const COLORS = [
  '#dc2626', // red-600
  '#ea580c', // orange-600
  '#ca8a04', // yellow-600
  '#16a34a', // green-600
  '#2563eb', // blue-600
  '#7c3aed', // violet-600
  '#18181b', // zinc-900
]

export function ScreenshotEditor({ imageUrl, onSave, onCancel }: ScreenshotEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1) // Start at 100%
  const [tool, setTool] = useState<DrawingTool>(null)
  const [color, setColor] = useState('#dc2626')
  const [elements, setElements] = useState<DrawingElement[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null)
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 })

  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const shapeRefs = useRef<Map<string, Konva.Shape>>(new Map())
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 600 })

  // Measure container size
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    updateContainerSize()
    window.addEventListener('resize', updateContainerSize)
    return () => window.removeEventListener('resize', updateContainerSize)
  }, [])

  // Load image and calculate initial zoom to full width
  useEffect(() => {
    const img = new window.Image()
    img.src = imageUrl
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImage(img)
      // Store the actual image dimensions
      setStageSize({
        width: img.width,
        height: img.height,
      })

      // Calculate zoom to fill container width (scroll vertically to see more)
      const container = containerRef.current
      if (container) {
        const containerWidth = container.clientWidth
        const fullWidthZoom = Math.min(containerWidth / img.width, 1) // Don't zoom past 100%
        setZoom(fullWidthZoom)

        // Position at top-left (scroll down to see more)
        setStagePos({ x: 0, y: 0 })
      }
    }
  }, [imageUrl])

  // Handle zoom
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25))

  // Fit to container
  const handleZoomFit = useCallback(() => {
    if (!image || !containerRef.current) return
    const containerWidth = containerRef.current.clientWidth - 40
    const containerHeight = containerRef.current.clientHeight - 40
    const fitZoom = Math.min(
      containerWidth / stageSize.width,
      containerHeight / stageSize.height,
      1
    )
    setZoom(fitZoom)
    const scaledWidth = stageSize.width * fitZoom
    const scaledHeight = stageSize.height * fitZoom
    setStagePos({
      x: (containerRef.current.clientWidth - scaledWidth) / 2,
      y: (containerRef.current.clientHeight - scaledHeight) / 2,
    })
  }, [image, stageSize.height, stageSize.width])

  // Reset to 100% and center
  const handleZoomReset = useCallback(() => {
    if (!containerRef.current) return
    setZoom(1)
    // Center the image at 100%
    setStagePos({
      x: (containerRef.current.clientWidth - stageSize.width) / 2,
      y: (containerRef.current.clientHeight - stageSize.height) / 2,
    })
  }, [stageSize.height, stageSize.width])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === '+' || e.key === '=') {
        setZoom(prev => Math.min(prev + 0.25, 3))
      } else if (e.key === '-') {
        setZoom(prev => Math.max(prev - 0.25, 0.25))
      } else if (e.key === '0') {
        handleZoomFit()
      } else if (e.key === '1') {
        handleZoomReset() // 100%
      } else if (e.key === 'v' || e.key === 'V') {
        setTool('select')
      } else if (e.key === 'Escape') {
        setSelectedId(null)
        setTool(null)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Delete selected element
        setElements(prev => prev.filter(el => el.id !== selectedId))
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleZoomFit, handleZoomReset, selectedId])

  // Attach transformer to selected shape
  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const node = shapeRefs.current.get(selectedId)
      if (node) {
        transformerRef.current.nodes([node])
        transformerRef.current.getLayer()?.batchDraw()
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([])
    }
  }, [selectedId])

  // Get pointer position relative to stage (accounting for zoom and pan)
  const getPointerPosition = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return null
    const pointer = stage.getPointerPosition()
    if (!pointer) return null

    // Transform pointer position to account for zoom and pan
    return {
      x: (pointer.x - stagePos.x) / zoom,
      y: (pointer.y - stagePos.y) / zoom,
    }
  }, [zoom, stagePos])

  // Handle clicking on a shape to select it
  const handleShapeClick = useCallback((id: string) => {
    if (tool === 'select' || !tool) {
      setSelectedId(id)
    }
  }, [tool])

  // Handle shape drag end - update element position
  const handleDragEnd = useCallback((id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    setElements(prev => prev.map(el => {
      if (el.id !== id) return el
      return {
        ...el,
        x: node.x(),
        y: node.y(),
      }
    }))
  }, [])

  // Handle transform end - update element size/position
  const handleTransformEnd = useCallback((id: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()

    // Reset scale and apply to dimensions
    node.scaleX(1)
    node.scaleY(1)

    setElements(prev => prev.map(el => {
      if (el.id !== id) return el
      if (el.type === 'rectangle') {
        return {
          ...el,
          x: node.x(),
          y: node.y(),
          width: Math.max(5, (el.width || 0) * scaleX),
          height: Math.max(5, (el.height || 0) * scaleY),
        }
      }
      if (el.type === 'circle') {
        return {
          ...el,
          x: node.x(),
          y: node.y(),
          radius: Math.max(5, (el.radius || 0) * Math.max(scaleX, scaleY)),
        }
      }
      if (el.type === 'text') {
        return {
          ...el,
          x: node.x(),
          y: node.y(),
        }
      }
      return el
    }))
  }, [])

  // Handle mouse down
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Check what was clicked
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'backgroundImage'

    // Click on empty area deselects any selected shape
    if (clickedOnEmpty) {
      setSelectedId(null)
    }

    const point = getPointerPosition()
    if (!point) return

    // Handle panning - works with pan tool OR no tool on empty space
    if (tool === 'pan' || (!tool && clickedOnEmpty) || (tool === 'select' && clickedOnEmpty)) {
      setIsPanning(true)
      const stage = stageRef.current
      if (stage) {
        const pointer = stage.getPointerPosition()
        if (pointer) {
          setLastPanPos({ x: pointer.x, y: pointer.y })
        }
      }
      return
    }

    // Select mode or no tool - just handle selection (clicking shapes handled by shape onClick)
    if (tool === 'select' || !tool) return

    setIsDrawing(true)
    startPointRef.current = point

    const id = Date.now().toString()

    if (tool === 'pen') {
      setCurrentElement({
        id,
        type: 'line',
        points: [point.x, point.y],
        color,
      })
    } else if (tool === 'rectangle') {
      setCurrentElement({
        id,
        type: 'rectangle',
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
        color,
      })
    } else if (tool === 'circle') {
      setCurrentElement({
        id,
        type: 'circle',
        x: point.x,
        y: point.y,
        radius: 0,
        color,
      })
    } else if (tool === 'text') {
      const text = prompt('Enter text:')
      if (text) {
        setElements(prev => [...prev, {
          id,
          type: 'text',
          x: point.x,
          y: point.y,
          text,
          color,
        }])
      }
      setTool(null)
    }
  }, [tool, color, getPointerPosition])

  // Handle mouse move
  const handleMouseMove = useCallback(() => {
    // Handle panning (works when isPanning is true, regardless of tool)
    if (isPanning) {
      const stage = stageRef.current
      if (stage) {
        const pointer = stage.getPointerPosition()
        if (pointer) {
          const dx = pointer.x - lastPanPos.x
          const dy = pointer.y - lastPanPos.y
          setStagePos(prev => ({ x: prev.x + dx, y: prev.y + dy }))
          setLastPanPos({ x: pointer.x, y: pointer.y })
        }
      }
      return
    }

    if (!isDrawing || !currentElement || !startPointRef.current) return
    const point = getPointerPosition()
    if (!point) return

    if (currentElement.type === 'line') {
      setCurrentElement(prev => prev ? {
        ...prev,
        points: [...(prev.points || []), point.x, point.y],
      } : null)
    } else if (currentElement.type === 'rectangle') {
      setCurrentElement(prev => prev ? {
        ...prev,
        width: point.x - (startPointRef.current?.x || 0),
        height: point.y - (startPointRef.current?.y || 0),
      } : null)
    } else if (currentElement.type === 'circle') {
      const radius = Math.sqrt(
        Math.pow(point.x - (startPointRef.current?.x || 0), 2) +
        Math.pow(point.y - (startPointRef.current?.y || 0), 2)
      )
      setCurrentElement(prev => prev ? {
        ...prev,
        radius,
      } : null)
    }
  }, [isDrawing, currentElement, getPointerPosition, isPanning, lastPanPos])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (currentElement) {
      setElements(prev => [...prev, currentElement])
    }
    setIsDrawing(false)
    setCurrentElement(null)
    startPointRef.current = null
  }, [currentElement, isPanning])

  // Handle wheel zoom
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const scaleBy = 1.1
    const stage = stageRef.current
    if (!stage) return

    const oldScale = zoom
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    }

    const newScale = e.evt.deltaY < 0
      ? Math.min(oldScale * scaleBy, 3)
      : Math.max(oldScale / scaleBy, 0.1)

    setZoom(newScale)
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }, [zoom, stagePos])

  // Clear all annotations
  const handleClear = () => {
    setElements([])
    setCurrentElement(null)
  }

  // Undo last annotation
  const handleUndo = () => {
    setElements(prev => prev.slice(0, -1))
  }

  // Save edited image
  const handleSave = () => {
    const stage = stageRef.current
    if (!stage || !image) return

    // Reset zoom and position for export
    const tempZoom = zoom
    const tempPos = { ...stagePos }

    stage.scale({ x: 1, y: 1 })
    stage.position({ x: 0, y: 0 })
    stage.batchDraw()

    // Export only the image area, not the entire stage
    const dataUrl = stage.toDataURL({
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
      pixelRatio: 1, // Use actual resolution
      mimeType: 'image/jpeg',
      quality: 0.92,
    })

    // Restore zoom and position
    stage.scale({ x: tempZoom, y: tempZoom })
    stage.position(tempPos)
    stage.batchDraw()

    onSave(dataUrl)
  }

  const getCursor = () => {
    if (isPanning) return 'grabbing'
    if (tool === 'pan' || !tool) return 'grab'
    if (tool === 'select') return 'default'
    return 'crosshair'
  }

  return (
    <div className="flex flex-col gap-3 max-h-[80vh]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap bg-muted/50 p-2 rounded-lg">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 border-r border-border/50 pr-3 mr-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            onClick={handleZoomReset}
            className="text-xs w-14 text-center font-medium hover:bg-accent rounded px-1 py-0.5"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Select tool */}
        <Button
          variant={tool === 'select' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setTool(tool === 'select' ? null : 'select')}
          title="Select & Move (V)"
        >
          <MousePointer2 className="h-4 w-4" />
        </Button>

        {/* Pan tool */}
        <Button
          variant={tool === 'pan' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setTool(tool === 'pan' ? null : 'pan')}
          title="Pan (hold Space)"
        >
          <Move className="h-4 w-4" />
        </Button>

        {/* Separator */}
        <div className="h-6 w-px bg-border/50 mx-1" />

        {/* Drawing tools */}
        <Button
          variant={tool === 'pen' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setTool(tool === 'pen' ? null : 'pen')}
          title="Freehand"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant={tool === 'rectangle' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setTool(tool === 'rectangle' ? null : 'rectangle')}
          title="Rectangle"
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          variant={tool === 'circle' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setTool(tool === 'circle' ? null : 'circle')}
          title="Circle"
        >
          <CircleIcon className="h-4 w-4" />
        </Button>
        <Button
          variant={tool === 'text' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setTool(tool === 'text' ? null : 'text')}
          title="Text"
        >
          <Type className="h-4 w-4" />
        </Button>

        {/* Separator */}
        <div className="h-6 w-px bg-border/50 mx-1" />

        {/* Color picker */}
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              className={cn(
                'w-6 h-6 rounded-md transition-all border-2',
                color === c
                  ? 'border-foreground scale-110'
                  : 'border-transparent hover:border-muted-foreground/30'
              )}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border/50 mx-1" />

        {/* Undo/Clear */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleUndo}
          disabled={elements.length === 0}
          title="Undo"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleClear}
          disabled={elements.length === 0}
          title="Clear all"
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Save/Cancel */}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>

      {/* Stage container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden bg-zinc-900/50 rounded-lg border flex-1 min-h-[500px]"
        style={{ cursor: getCursor() }}
      >
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          scaleX={zoom}
          scaleY={zoom}
          x={stagePos.x}
          y={stagePos.y}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <Layer>
            {/* Background image - use actual image dimensions */}
            {image && (
              <KonvaImage
                image={image}
                width={image.width}
                height={image.height}
                name="backgroundImage"
              />
            )}

            {/* Existing elements */}
            {elements.map(el => {
              const isDraggable = tool === 'select' || !tool

              if (el.type === 'line' && el.points) {
                return (
                  <Line
                    key={el.id}
                    points={el.points}
                    stroke={el.color}
                    strokeWidth={3 / zoom}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    onClick={() => handleShapeClick(el.id)}
                    onTap={() => handleShapeClick(el.id)}
                  />
                )
              }
              if (el.type === 'rectangle') {
                return (
                  <Rect
                    key={el.id}
                    ref={(node) => {
                      if (node) shapeRefs.current.set(el.id, node)
                      else shapeRefs.current.delete(el.id)
                    }}
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    stroke={el.color}
                    strokeWidth={3 / zoom}
                    draggable={isDraggable}
                    onClick={() => handleShapeClick(el.id)}
                    onTap={() => handleShapeClick(el.id)}
                    onDragEnd={(e) => handleDragEnd(el.id, e)}
                    onTransformEnd={(e) => handleTransformEnd(el.id, e)}
                  />
                )
              }
              if (el.type === 'circle') {
                return (
                  <Circle
                    key={el.id}
                    ref={(node) => {
                      if (node) shapeRefs.current.set(el.id, node)
                      else shapeRefs.current.delete(el.id)
                    }}
                    x={el.x}
                    y={el.y}
                    radius={el.radius}
                    stroke={el.color}
                    strokeWidth={3 / zoom}
                    draggable={isDraggable}
                    onClick={() => handleShapeClick(el.id)}
                    onTap={() => handleShapeClick(el.id)}
                    onDragEnd={(e) => handleDragEnd(el.id, e)}
                    onTransformEnd={(e) => handleTransformEnd(el.id, e)}
                  />
                )
              }
              if (el.type === 'text') {
                return (
                  <Text
                    key={el.id}
                    ref={(node) => {
                      if (node) shapeRefs.current.set(el.id, node)
                      else shapeRefs.current.delete(el.id)
                    }}
                    x={el.x}
                    y={el.y}
                    text={el.text}
                    fill={el.color}
                    fontSize={16 / zoom}
                    fontStyle="bold"
                    draggable={isDraggable}
                    onClick={() => handleShapeClick(el.id)}
                    onTap={() => handleShapeClick(el.id)}
                    onDragEnd={(e) => handleDragEnd(el.id, e)}
                    onTransformEnd={(e) => handleTransformEnd(el.id, e)}
                  />
                )
              }
              return null
            })}

            {/* Current drawing element */}
            {currentElement && (
              <>
                {currentElement.type === 'line' && currentElement.points && (
                  <Line
                    points={currentElement.points}
                    stroke={currentElement.color}
                    strokeWidth={3 / zoom}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}
                {currentElement.type === 'rectangle' && (
                  <Rect
                    x={currentElement.x}
                    y={currentElement.y}
                    width={currentElement.width}
                    height={currentElement.height}
                    stroke={currentElement.color}
                    strokeWidth={3 / zoom}
                  />
                )}
                {currentElement.type === 'circle' && (
                  <Circle
                    x={currentElement.x}
                    y={currentElement.y}
                    radius={currentElement.radius}
                    stroke={currentElement.color}
                    strokeWidth={3 / zoom}
                  />
                )}
              </>
            )}

            {/* Transformer for selected shapes */}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // Limit minimum size
                if (newBox.width < 5 || newBox.height < 5) {
                  return oldBox
                }
                return newBox
              }}
              anchorSize={8 / zoom}
              borderStrokeWidth={1 / zoom}
              anchorStroke="#2563eb"
              anchorFill="#fff"
              borderStroke="#2563eb"
              rotateEnabled={false}
            />
          </Layer>
        </Stage>
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground text-center">
        {tool === 'pan'
          ? 'Click and drag to pan. Scroll to zoom.'
          : tool === 'select'
            ? 'Click shapes to select, drag to move, handles to resize. Press Delete to remove.'
            : tool
              ? 'Click and drag to draw. Scroll to zoom.'
              : 'Drag to pan, scroll to zoom. Select a tool to annotate.'}
      </p>
    </div>
  )
}
