#!/usr/bin/env python3
"""
自動重排 messaging-main.ts 路由順序
將靜態路由移到動態路由之前
"""

import re

def reorder_routes():
    # 讀取文件
    with open('src/handlers/messaging-main.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # 定義路由模式 - 找到完整的路由定義（包括註釋和函數體）
    # 我們需要匹配從註釋開始到 }); 結束的完整路由塊

    # 策略：找到特定路由的開始和結束行號
    lines = content.split('\n')

    # 找到關鍵路由的位置
    route_positions = {}
    current_route = None
    brace_count = 0
    route_start = -1

    for i, line in enumerate(lines):
        # 檢測路由定義開始
        if re.search(r"app\.(get|post|put|delete)\(['\"]", line):
            if current_route is None:
                # 找到路由定義，往回找註釋開始
                comment_start = i
                for j in range(i-1, max(0, i-10), -1):
                    if lines[j].strip() == '' or lines[j].strip().startswith('/**') or lines[j].strip().startswith('*') or lines[j].strip().startswith('//'):
                        comment_start = j
                    else:
                        break

                # 提取路由路徑
                match = re.search(r"app\.(get|post|put|delete)\(['\"]([^'\"]+)['\"]", line)
                if match:
                    method = match.group(1)
                    path = match.group(2)
                    current_route = f"{method.upper()} {path}"
                    route_start = comment_start
                    brace_count = line.count('{') - line.count('}')

        # 跟蹤大括號計數
        elif current_route:
            brace_count += line.count('{') - line.count('}')

            # 找到路由結束
            if '});' in line and brace_count <= 0:
                route_positions[current_route] = (route_start, i)
                current_route = None
                brace_count = 0

    print(f"找到 {len(route_positions)} 個路由")
    for route, (start, end) in sorted(route_positions.items(), key=lambda x: x[1][0]):
        print(f"  {route}: 行 {start+1}-{end+1}")

    # 定義需要移動的路由和目標位置
    # 目標：將 /search, /stats, /tags, /export 移到 /:id 之前

    routes_to_move = [
        'GET /search',
        'GET /stats',
        'GET /tags',
        'GET /export'
    ]

    target_route = 'GET /:id'  # 在這個之前插入

    if target_route not in route_positions:
        print(f"錯誤：找不到目標路由 {target_route}")
        return False

    target_pos = route_positions[target_route][0]

    # 提取要移動的路由代碼
    routes_code = []
    for route in routes_to_move:
        if route in route_positions:
            start, end = route_positions[route]
            route_code = '\n'.join(lines[start:end+1])
            routes_code.append((route, route_code, start, end))
            print(f"提取路由: {route}")
        else:
            print(f"警告：找不到路由 {route}")

    # 按原始位置排序（從後往前刪除，避免位置變化）
    routes_code.sort(key=lambda x: x[2], reverse=True)

    # 從後往前刪除原位置的路由
    for route, code, start, end in routes_code:
        del lines[start:end+1]
        # 如果刪除的位置在目標位置之前，需要調整目標位置
        if end < target_pos:
            target_pos -= (end - start + 1)

    # 在目標位置之前插入路由（按正確順序）
    routes_code.reverse()  # 恢復原始順序
    insert_lines = []
    for route, code, _, _ in routes_code:
        insert_lines.extend(code.split('\n'))
        insert_lines.append('')  # 添加空行分隔

    # 插入到目標位置
    lines[target_pos:target_pos] = insert_lines

    # 重新組合內容
    new_content = '\n'.join(lines)

    # 寫回文件
    with open('src/handlers/messaging-main.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)

    print("\n✅ 路由重排完成！")
    print(f"   移動了 {len(routes_code)} 個路由到 GET /:id 之前")
    return True

if __name__ == '__main__':
    success = reorder_routes()
    exit(0 if success else 1)