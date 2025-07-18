import React from 'react';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
}

interface TableHeadProps extends React.HTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
}

interface TableCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
}

export function Table({ children, className, ...props }: TableProps) {
  return (
    <table className={`min-w-full divide-y divide-gray-200 ${className || ''}`} {...props}>
      {children}
    </table>
  );
}

Table.Header = function Header({ children, className, ...props }: TableHeaderProps) {
  return (
    <thead className={`bg-gray-50 ${className || ''}`} {...props}>
      {children}
    </thead>
  );
};

Table.Body = function Body({ children, className, ...props }: TableBodyProps) {
  return (
    <tbody className={`bg-white divide-y divide-gray-200 ${className || ''}`} {...props}>
      {children}
    </tbody>
  );
};

Table.Row = function Row({ children, className, ...props }: TableRowProps) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
};

Table.Head = function Head({ children, className, ...props }: TableHeadProps) {
  return (
    <th
      scope="col"
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className || ''}`}
      {...props}
    >
      {children}
    </th>
  );
};

Table.Cell = function Cell({ children, className, ...props }: TableCellProps) {
  return (
    <td className={`px-6 py-4 whitespace-nowrap ${className || ''}`} {...props}>
      {children}
    </td>
  );
};

export default Table;