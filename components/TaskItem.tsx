import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Wand2, Trash2, GripVertical, Sparkles, Calendar, Clock, X, Pencil, Tag as TagIcon, Hash } from 'lucide-react';
import { Task, Account, Priority, Tag } from '../types';
import { AccountBadge } from './AccountBadge';
import { DatePicker } from './DatePicker';
import { EditTaskModal } from './EditTaskModal';

interface TaskItemProps {
  task: Task;
  account: Account;
  availableTags?: Tag[];
  onToggle: (id: string) => void;
  onSubtaskToggle: (taskId: string, subtaskId: string) => void;
  onDelete: (id: string) => void;
  onBreakdown: (id: string) => void;
  isBreakingDown: boolean;
  onSubtasksReorder: (taskId: string, newSubtasks: Task[]) => void;
  onUpdatePriority: (id: string, priority: Priority) => void;
  onUpdateDueDate: (id: string, date: string | undefined) => void;
  onUpdateTask: (id: string, title: string, description?: string) => void;
  onTagToggle?: (taskId: string, tagId: string) => void;
  
  // Drag props for the main task
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, id: string) => void;

  // Context
  isSubtask?: boolean;
}

export const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  account, 
  availableTags = [],
  onToggle, 
  onSubtaskToggle,
  onDelete, 
  onBreakdown,
  isBreakingDown,
  onSubtasksReorder,
  onUpdatePriority,
  onUpdateDueDate,
  onUpdateTask,
  onTagToggle,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  isSubtask = false
}) => {
  const [expanded, setExpanded] = useState(true); // Default to expanded for better visibility
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  
  // Date Picker State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const priorityColors = {
    [Priority.LOW]: 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
    [Priority.MEDIUM]: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-500 dark:hover:bg-yellow-900/50',
    [Priority.HIGH]: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50',
  };

  const allSubtasksComplete = task.subTasks && task.subTasks.length > 0 && task.subTasks.every(st => st.completed);

  // --- Recursive Handler Helpers ---

  // Called when a child task (subtask) reorders *its* children
  const handleChildSubtasksReorder = (childId: string, newGrandChildren: Task[]) => {
    if (!task.subTasks) return;
    
    const newSubtasks = task.subTasks.map(st => 
      st.id === childId ? { ...st, subTasks: newGrandChildren } : st
    );
    
    // Bubble up the change to our parent
    onSubtasksReorder(task.id, newSubtasks);
  };

  // Called when a child task toggles its own subtask (Level 2+ depth)
  const handleChildSubtaskToggle = (childId: string, grandChildId: string) => {
    // This is for deep nesting support, effectively bubbling the event up.
    // In a real backend sync, we might just hit the API directly, but for React state we bubble.
    // However, onSubtaskToggle currently takes (taskId, subtaskId). 
    // Since we are treating everything as recursive tasks, we can simply use onToggle logic recursively 
    // via the standard update mechanism if we wanted, but to maintain current App.tsx logic:
    
    // Note: The current App.tsx toggleSubtask logic is flat (parent -> child). 
    // To support infinite recursion properly, App.tsx would need a recursive finder.
    // For now, we rely on the fact that we are passing the handlers down.
    onSubtaskToggle(childId, grandChildId);
  };


  // --- Local Drag Handling for Immediate Children ---

  const handleLocalDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation(); // Critical: Don't let parent think *this* task is being dragged
    setDraggedSubtaskId(id);
  };

  const handleLocalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleLocalDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedSubtaskId || draggedSubtaskId === targetId || !task.subTasks) return;

    const newSubtasks = [...task.subTasks];
    const sourceIndex = newSubtasks.findIndex(st => st.id === draggedSubtaskId);
    const targetIndex = newSubtasks.findIndex(st => st.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // Move the subtask
    const [movedSubtask] = newSubtasks.splice(sourceIndex, 1);
    newSubtasks.splice(targetIndex, 0, movedSubtask);

    onSubtasksReorder(task.id, newSubtasks);
    setDraggedSubtaskId(null);
  };


  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
  };

  // Filter tags assigned to this task
  const assignedTags = availableTags.filter(tag => task.tags?.includes(tag.id));

  // Styles based on hierarchy level
  const containerClasses = isSubtask 
    ? `group relative pl-2 border-l-2 border-gray-200 dark:border-slate-700 my-1 transition-all duration-200 ${task.completed ? 'opacity-60' : ''}`
    : `group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-slate-900 dark:border-slate-800 ${task.completed ? 'opacity-60 bg-gray-50 dark:bg-slate-900/50' : ''}`;

  const paddingClasses = isSubtask ? 'py-1 pr-0' : 'p-4';

  return (
    <div 
      draggable={draggable}
      onDragStart={(e) => onDragStart && onDragStart(e, task.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop && onDrop(e, task.id)}
      className={containerClasses}
    >
      <div className={`${paddingClasses} flex items-start gap-3`}>
        {/* Drag Handle */}
        {draggable && (
            <div className={`mt-1.5 text-gray-300 cursor-move hover:text-gray-500 transition-colors touch-none dark:text-slate-700 dark:hover:text-slate-500 ${isSubtask ? 'scale-75 -ml-1' : ''}`}>
            <GripVertical className="w-4 h-4" />
            </div>
        )}

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
          className={`mt-1 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSubtask ? 'w-4 h-4 border-gray-300' : 'w-6 h-6'
          } ${
            task.completed 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-gray-300 hover:border-indigo-400 text-transparent dark:border-slate-600 dark:hover:border-indigo-400'
          }`}
        >
          <Check className={isSubtask ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} strokeWidth={3} />
        </button>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <div className="flex flex-col gap-1">
            {/* Title */}
            <h3 className={`${isSubtask ? 'text-sm' : 'text-base'} font-medium text-gray-800 leading-tight break-words dark:text-gray-200 ${task.completed ? 'line-through text-gray-500 dark:text-gray-500' : ''}`}>
              {task.title}
            </h3>
            
            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2 mt-1 mb-1">
               {/* Priority Dropdown */}
               {!isSubtask && (
                   <div className="relative">
                    <button 
                    onClick={() => !task.completed && setIsPriorityMenuOpen(!isPriorityMenuOpen)}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide transition-colors cursor-pointer ${priorityColors[task.priority]}`}
                    >
                    {task.priority}
                    </button>
                    
                    {isPriorityMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsPriorityMenuOpen(false)} />
                        <div className="absolute left-0 top-full mt-1 w-24 bg-white rounded-lg shadow-xl border border-gray-100 z-20 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 dark:bg-slate-900 dark:border-slate-700">
                        {Object.values(Priority).map((p) => (
                            <button
                            key={p}
                            onClick={() => {
                                onUpdatePriority(task.id, p);
                                setIsPriorityMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 ${task.priority === p ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}
                            >
                            {p}
                            </button>
                        ))}
                        </div>
                    </>
                    )}
                </div>
               )}
               
               {!isSubtask && <AccountBadge account={account} />}

               {/* Tags */}
               {assignedTags.map(tag => (
                 <span 
                   key={tag.id} 
                   className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-${tag.color}-50 text-${tag.color}-700 border border-${tag.color}-100 dark:bg-${tag.color}-900/30 dark:text-${tag.color}-300 dark:border-${tag.color}-800/50`}
                 >
                   <Hash className="w-2.5 h-2.5 opacity-60" />
                   {tag.name}
                 </span>
               ))}
            </div>
          </div>
          
          {task.description && !isSubtask && (
            <p className={`text-sm text-gray-500 mt-1 dark:text-gray-400 ${task.completed ? 'line-through' : ''}`}>
              {task.description}
            </p>
          )}

          {/* Footer / Actions */}
          <div className={`flex flex-wrap items-center justify-between gap-y-2 ${isSubtask ? 'mt-1' : 'mt-3'}`}>
            <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              
              {/* Date Picker */}
              <div className="relative flex items-center">
                   <button
                      onClick={() => !task.completed && setIsDatePickerOpen(!isDatePickerOpen)}
                      className={`flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-gray-100 transition-colors dark:hover:bg-slate-800 ${task.completed ? 'cursor-default' : 'cursor-pointer'}`}
                      title="Set due date"
                   >
                      {task.dueDate ? (
                        <>
                          <Clock className={`w-3.5 h-3.5 ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-indigo-500 dark:text-indigo-400'}`} />
                          <span className={`${new Date(task.dueDate) < new Date() ? 'text-red-600 font-medium' : 'text-indigo-600 dark:text-indigo-400'}`}>
                            {formatDate(task.dueDate)}
                          </span>
                        </>
                      ) : (
                        !isSubtask && (
                            <>
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Add Due Date</span>
                            </>
                        )
                      )}
                   </button>
                 
                 {isDatePickerOpen && (
                    <DatePicker 
                      initialDate={task.dueDate}
                      onSave={(date) => onUpdateDueDate(task.id, date)}
                      onClose={() => setIsDatePickerOpen(false)}
                    />
                 )}
                 
                 {task.dueDate && !task.completed && !isDatePickerOpen && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onUpdateDueDate(task.id, undefined); }}
                      className="ml-1 p-0.5 hover:bg-gray-200 rounded-full transition-all text-gray-400 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300"
                      title="Clear date"
                    >
                      <X className="w-3 h-3" />
                    </button>
                 )}
              </div>

              {task.subTasks && task.subTasks.length > 0 && (
                <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-slate-700">
                  <span className={`flex items-center gap-1 font-medium ${allSubtasksComplete ? 'text-green-600 dark:text-green-400' : 'text-indigo-500 dark:text-indigo-400'}`}>
                    {task.subTasks.filter(st => st.completed).length}/{task.subTasks.length} subtasks
                  </span>
                  
                  {!task.completed && allSubtasksComplete && !isSubtask && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
                       className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold hover:bg-green-200 transition-colors animate-pulse dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                     >
                       <Sparkles className="w-3 h-3" />
                       Complete Task?
                     </button>
                  )}
                </div>
              )}
            </div>

            {/* Hover Actions */}
            <div className={`flex items-center gap-1 transition-opacity ${isSubtask ? 'opacity-0 group-hover:opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
              {!task.completed && (
                 <>
                  {/* Tag Menu - Only show on root tasks for simplicity in this view */}
                  {!isSubtask && (
                    <div className="relative">
                        <button
                        onClick={() => setIsTagMenuOpen(!isTagMenuOpen)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                        title="Manage Tags"
                        >
                        <TagIcon className="w-3.5 h-3.5" />
                        </button>
                        {isTagMenuOpen && (
                            <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsTagMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-100 z-20 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 dark:bg-slate-900 dark:border-slate-700">
                                {availableTags.length === 0 && (
                                <p className="px-3 py-2 text-xs text-gray-400 italic text-center">No tags available.</p>
                                )}
                                {availableTags.map(tag => {
                                const isSelected = task.tags?.includes(tag.id);
                                return (
                                    <button
                                    key={tag.id}
                                    onClick={() => onTagToggle && onTagToggle(task.id, tag.id)}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 dark:hover:bg-slate-800"
                                    >
                                    <div className={`w-3 h-3 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
                                        {isSelected && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <span className={`truncate ${isSelected ? 'text-gray-900 font-medium dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{tag.name}</span>
                                    </button>
                                );
                                })}
                            </div>
                            </>
                        )}
                    </div>
                  )}

                  <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                    title="Edit Task"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  
                  {!isSubtask && (
                    <button 
                        onClick={() => onBreakdown(task.id)}
                        disabled={isBreakingDown}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                        title="Use AI to break down this task"
                    >
                        <Wand2 className={`w-3.5 h-3.5 ${isBreakingDown ? 'animate-spin' : ''}`} />
                        Break Down
                    </button>
                  )}
                </>
              )}
              <button 
                onClick={() => onDelete(task.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/30 dark:hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recursive Subtasks Section */}
      {task.subTasks && task.subTasks.length > 0 && (
        <div className={`${isSubtask ? 'pl-4 mt-1' : 'border-t border-gray-50 bg-gray-50/50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/30'}`}>
          
          {!isSubtask && (
            <button 
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 w-full py-1 mb-1 dark:text-gray-400 dark:hover:text-gray-300"
            >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? 'Hide' : 'Show'} Subtasks
            </button>
          )}
          
          {expanded && (
            <div className={`${isSubtask ? '' : 'space-y-1'}`}>
              {task.subTasks.map(st => (
                <TaskItem
                  key={st.id}
                  task={st}
                  account={account}
                  availableTags={availableTags}
                  onToggle={onToggle} // Handles recursive logic in App or via bubble
                  onSubtaskToggle={handleChildSubtaskToggle} // Bubble up for deep nesting
                  onDelete={onDelete} // Deleting a subtask is like deleting a task
                  onBreakdown={onBreakdown}
                  isBreakingDown={isBreakingDown}
                  onSubtasksReorder={handleChildSubtasksReorder} // Recursive reordering
                  onUpdatePriority={onUpdatePriority}
                  onUpdateDueDate={onUpdateDueDate}
                  onUpdateTask={onUpdateTask}
                  onTagToggle={onTagToggle}
                  
                  // Subtasks are always draggable within their container
                  draggable={true}
                  onDragStart={handleLocalDragStart}
                  onDragOver={handleLocalDragOver}
                  onDrop={handleLocalDrop}
                  
                  isSubtask={true}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <EditTaskModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        task={task}
        onSave={onUpdateTask}
      />
    </div>
  );
};