import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface TreeNode {
  id: string;
  label: React.ReactNode;
  children?: TreeNode[];
  checked?: boolean | 'indeterminate';
  expanded?: boolean;
}

interface TreeProps {
  data: TreeNode[];
  onNodeCheck?: (nodeId: string, checked: boolean) => void;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  showCheckbox?: boolean;
  className?: string;
}

interface TreeItemProps {
  node: TreeNode;
  level: number;
  onNodeCheck?: (nodeId: string, checked: boolean) => void;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  showCheckbox?: boolean;
}

const TreeItem: React.FC<TreeItemProps> = ({ node, level, onNodeCheck, onNodeExpand, showCheckbox = true }) => {
  const [expanded, setExpanded] = React.useState(node.expanded ?? false);
  const [checked, setChecked] = React.useState(node.checked ?? false);
  const hasChildren = node.children && node.children.length > 0;

  const handleExpand = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onNodeExpand?.(node.id, newExpanded);
  };

  const handleCheck = (checkedState: boolean) => {
    setChecked(checkedState);
    onNodeCheck?.(node.id, checkedState);
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center py-1.5 px-2 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer',
          'transition-colors duration-150',
        )}
        style={{ paddingLeft: `${level * 1.5}rem` }}
      >
        <button onClick={handleExpand} className="mr-1 p-0.5 hover:bg-muted rounded-sm transition-colors" type="button">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="w-4 h-4 inline-block" />
          )}
        </button>

        {showCheckbox && <Checkbox checked={checked} onCheckedChange={handleCheck} className="mr-2" />}

        <div className="text-sm">{node.label}</div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children!.map(child => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onNodeCheck={onNodeCheck}
              onNodeExpand={onNodeExpand}
              showCheckbox={showCheckbox}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Tree: React.FC<TreeProps> = ({ data, onNodeCheck, onNodeExpand, showCheckbox = true, className }) => {
  return (
    <div className={cn('w-full', className)}>
      {data.map(node => (
        <TreeItem
          key={node.id}
          node={node}
          level={0}
          onNodeCheck={onNodeCheck}
          onNodeExpand={onNodeExpand}
          showCheckbox={showCheckbox}
        />
      ))}
    </div>
  );
};

export type { TreeNode };
