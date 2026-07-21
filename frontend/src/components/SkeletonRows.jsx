export default function SkeletonRows({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr className="skeleton-row" key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}>
              <div className={`skeleton skeleton-line${c === cols - 1 ? " short" : ""}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
