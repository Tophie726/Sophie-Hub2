'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MessageCircle,
  Loader2,
  Send,
  Reply,
  Lock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Pencil,
  X,
  ZoomIn,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { DrawingPad } from './drawing-pad'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'

function safeHref(url: string): string {
  const lower = url.toLowerCase().trim()
  if (lower.startsWith('http://') || lower.startsWith('https://')) return url
  if (lower.startsWith('data:image/') || lower.startsWith('data:application/pdf')) return url
  return '#'
}

interface CommentAttachment {
  type: 'image' | 'drawing' | 'file'
  url: string
  name?: string
  dataUrl?: string
}

interface Comment {
  id: string
  user_email: string
  content: string
  is_from_submitter: boolean
  is_internal: boolean
  parent_id: string | null
  created_at: string
  replies?: Comment[]
  attachments?: CommentAttachment[]
}

interface AdminCommentsProps {
  feedbackId: string
  submitterEmail: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

export function AdminComments({ feedbackId, submitterEmail }: AdminCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyIsInternal, setReplyIsInternal] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [attachments, setAttachments] = useState<CommentAttachment[]>([])
  const [drawingPadOpen, setDrawingPadOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [editingAttachmentIndex, setEditingAttachmentIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchComments()
  }, [feedbackId])

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/comments`)
      if (!res.ok) throw new Error('Failed to fetch comments')
      const json = await res.json()
      setComments(json.data?.comments || [])
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('File type not supported. Please use images or PDF.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      setAttachments(prev => [...prev, {
        type: file.type.startsWith('image/') ? 'image' : 'file',
        url: dataUrl,
        name: file.name,
        dataUrl,
      }])
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrawingSave = (imageDataUrl: string) => {
    if (editingAttachmentIndex !== null) {
      // Update existing attachment
      setAttachments(prev => prev.map((att, idx) =>
        idx === editingAttachmentIndex
          ? { ...att, url: imageDataUrl, dataUrl: imageDataUrl }
          : att
      ))
      setEditingAttachmentIndex(null)
    } else {
      // Add new attachment
      setAttachments(prev => [...prev, {
        type: 'drawing',
        url: imageDataUrl,
        name: `Drawing ${prev.filter(a => a.type === 'drawing').length + 1}`,
        dataUrl: imageDataUrl,
      }])
    }
  }

  const handleEditDrawing = (index: number) => {
    setEditingAttachmentIndex(index)
    setDrawingPadOpen(true)
  }

  const handleCloseDrawingPad = (open: boolean) => {
    setDrawingPadOpen(open)
    if (!open) {
      setEditingAttachmentIndex(null)
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() && attachments.length === 0) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          is_internal: isInternal,
          attachments: attachments.map(a => ({
            type: a.type,
            url: a.dataUrl || a.url,
            name: a.name,
          })),
        }),
      })

      if (!res.ok) throw new Error('Failed to add comment')

      setNewComment('')
      setIsInternal(false)
      setAttachments([])
      fetchComments()
      toast.success(isInternal ? 'Internal note added' : 'Comment added')
    } catch (error) {
      console.error('Failed to add comment:', error)
      toast.error('Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent.trim(),
          is_internal: replyIsInternal,
          parent_id: parentId,
        }),
      })

      if (!res.ok) throw new Error('Failed to add reply')

      setReplyContent('')
      setReplyIsInternal(false)
      setReplyingTo(null)
      fetchComments()
      toast.success('Reply added')
    } catch (error) {
      console.error('Failed to add reply:', error)
      toast.error('Failed to add reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return

    try {
      const res = await fetch(`/api/feedback/${feedbackId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete comment')

      fetchComments()
      toast.success('Comment deleted')
    } catch (error) {
      console.error('Failed to delete comment:', error)
      toast.error('Failed to delete comment')
    }
  }

  const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)

  return (
    <div className="pt-4 border-t">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left mb-3"
      >
        <h4 className="text-sm font-medium flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Comments & Discussion
          <Badge variant="secondary" className="text-xs">
            {totalComments}
          </Badge>
        </h4>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Comments List */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Add a note or reply to the submitter.
            </p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {comments.map(comment => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  submitterEmail={submitterEmail}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  replyIsInternal={replyIsInternal}
                  setReplyIsInternal={setReplyIsInternal}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  submitting={submitting}
                />
              ))}
              <div ref={commentsEndRef} />
            </div>
          )}

          {/* New Comment Form */}
          <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t">
            {/* Attachment Preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2">
                {attachments.map((att, idx) => (
                  <div key={idx} className="relative group">
                    {att.type === 'image' || att.type === 'drawing' ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(att.dataUrl || att.url)}
                          className="block"
                        >
                          <img
                            src={att.dataUrl || att.url}
                            alt={att.name || 'Attachment'}
                            className="h-16 w-16 object-cover rounded border hover:border-primary/50 transition-colors cursor-zoom-in"
                          />
                        </button>
                        {att.type === 'drawing' && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 text-center pointer-events-none">
                            Sketch
                          </div>
                        )}
                        {/* Edit button for drawings */}
                        {att.type === 'drawing' && (
                          <button
                            type="button"
                            onClick={() => handleEditDrawing(idx)}
                            className="absolute top-0.5 left-0.5 h-5 w-5 bg-background/90 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="Edit sketch"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        )}
                        {/* Zoom button */}
                        <button
                          type="button"
                          onClick={() => setPreviewImage(att.dataUrl || att.url)}
                          className="absolute bottom-0.5 right-0.5 h-5 w-5 bg-background/90 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="View full size"
                        >
                          <ZoomIn className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-16 px-2 flex items-center gap-1 bg-muted rounded text-[10px]">
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[60px]">{att.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={isInternal ? "Add an internal note (only admins can see)..." : "Add a comment..."}
              rows={2}
              className={cn(
                'resize-none text-sm',
                isInternal && 'border-amber-500/50 bg-amber-500/5'
              )}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="internal-toggle"
                  checked={isInternal}
                  onCheckedChange={setIsInternal}
                />
                <Label
                  htmlFor="internal-toggle"
                  className={cn(
                    'text-xs flex items-center gap-1 cursor-pointer',
                    isInternal ? 'text-amber-600' : 'text-muted-foreground'
                  )}
                >
                  <Lock className="h-3 w-3" />
                  Internal
                </Label>
                <div className="h-4 w-px bg-border mx-1" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_FILE_TYPES.join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Paperclip className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setDrawingPadOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || (!newComment.trim() && attachments.length === 0)}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {isInternal ? 'Add Note' : 'Comment'}
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Drawing Pad Modal */}
          <DrawingPad
            open={drawingPadOpen}
            onOpenChange={handleCloseDrawingPad}
            onSave={handleDrawingSave}
          />

          {/* Image Preview Modal */}
          <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
              {previewImage && (
                <img
                  src={previewImage}
                  alt="Preview"
                  className="w-full h-full object-contain max-h-[85vh]"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}

interface CommentThreadProps {
  comment: Comment
  submitterEmail: string
  replyingTo: string | null
  setReplyingTo: (id: string | null) => void
  replyContent: string
  setReplyContent: (content: string) => void
  replyIsInternal: boolean
  setReplyIsInternal: (internal: boolean) => void
  onReply: (parentId: string) => void
  onDelete: (commentId: string) => void
  submitting: boolean
}

function CommentThread({
  comment,
  submitterEmail,
  replyingTo,
  setReplyingTo,
  replyContent,
  setReplyContent,
  replyIsInternal,
  setReplyIsInternal,
  onReply,
  onDelete,
  submitting,
}: CommentThreadProps) {
  const isSubmitter = comment.user_email === submitterEmail
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })

  return (
    <div className="space-y-2">
      {/* Main Comment */}
      <div
        className={cn(
          'p-3 rounded-lg text-sm',
          comment.is_internal
            ? 'bg-amber-500/10 border border-amber-500/30'
            : isSubmitter
              ? 'bg-primary/5 border border-primary/20'
              : 'bg-muted/50'
        )}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-medium text-xs">
            {comment.user_email.split('@')[0]}
          </span>
          {isSubmitter && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Submitter
            </Badge>
          )}
          {comment.is_internal && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600">
              <Lock className="h-2.5 w-2.5 mr-0.5" />
              Internal
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {timeAgo}
          </span>
        </div>
        {comment.content && (
          <p className="whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Comment Attachments */}
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {comment.attachments.map((att, idx) => (
              <div key={idx}>
                {att.type === 'image' || att.type === 'drawing' ? (
                  <a href={safeHref(att.url)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={att.url}
                      alt={att.name || 'Attachment'}
                      className="max-h-24 rounded border hover:opacity-90 transition-opacity"
                    />
                  </a>
                ) : (
                  <a
                    href={safeHref(att.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded text-xs hover:bg-muted transition-colors"
                  >
                    <Paperclip className="h-3 w-3" />
                    {att.name || 'File'}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
          <button
            onClick={() => onDelete(comment.id)}
            className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-4 pl-3 border-l-2 border-muted space-y-2">
          {comment.replies.map(reply => (
            <div
              key={reply.id}
              className={cn(
                'p-2.5 rounded-lg text-sm',
                reply.is_internal
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : reply.user_email === submitterEmail
                    ? 'bg-primary/5 border border-primary/20'
                    : 'bg-muted/30'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-xs">
                  {reply.user_email.split('@')[0]}
                </span>
                {reply.user_email === submitterEmail && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    Submitter
                  </Badge>
                )}
                {reply.is_internal && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/50 text-amber-600">
                    <Lock className="h-2.5 w-2.5" />
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                </span>
              </div>
              {reply.content && (
                <p className="whitespace-pre-wrap text-xs">{reply.content}</p>
              )}
              {/* Reply Attachments */}
              {reply.attachments && reply.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {reply.attachments.map((att, idx) => (
                    <div key={idx}>
                      {att.type === 'image' || att.type === 'drawing' ? (
                        <a href={safeHref(att.url)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={att.url}
                            alt={att.name || 'Attachment'}
                            className="max-h-16 rounded border hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ) : (
                        <a
                          href={safeHref(att.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded text-[10px] hover:bg-muted transition-colors"
                        >
                          <Paperclip className="h-2.5 w-2.5" />
                          {att.name || 'File'}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => onDelete(reply.id)}
                className="text-[10px] text-muted-foreground hover:text-red-500 mt-1.5 flex items-center gap-0.5"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reply Form */}
      {replyingTo === comment.id && (
        <div className="ml-4 pl-3 border-l-2 border-primary/30 space-y-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={replyIsInternal ? "Internal reply..." : "Write a reply..."}
            rows={2}
            className={cn(
              'resize-none text-sm',
              replyIsInternal && 'border-amber-500/50 bg-amber-500/5'
            )}
            autoFocus
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id={`reply-internal-${comment.id}`}
                checked={replyIsInternal}
                onCheckedChange={setReplyIsInternal}
              />
              <Label
                htmlFor={`reply-internal-${comment.id}`}
                className={cn(
                  'text-xs flex items-center gap-1 cursor-pointer',
                  replyIsInternal ? 'text-amber-600' : 'text-muted-foreground'
                )}
              >
                <Lock className="h-3 w-3" />
                Internal
              </Label>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReplyingTo(null)
                  setReplyContent('')
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => onReply(comment.id)}
                disabled={submitting || !replyContent.trim()}
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Reply'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
