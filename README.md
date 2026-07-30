# llm-task-tree

鎶婇」鐩殑浠诲姟鍥撅紙`task-tree.md`锛夊彉鎴?Agent 鍙互鐩存帴璋冪敤鐨勫伐鍏凤細璇荤劍鐐广€佹寜瀛楁鍐欐爲銆侀摼寮忔帹杩涗竴姝ャ€佹鏌ユ墽琛屾祦绋嬫紓绉汇€佹绱㈡湰鍦扮煡璇嗗簱銆佽嚜鍔ㄦ暣鐞嗙敾甯冦€?

浠诲姟鍥炬槸浜轰笌 Agent 鍏变韩鐨勫缃蹇嗭細鑺傜偣淇濆瓨**褰撳墠鏈夋晥缁撹**锛堜笉鏄巻鍙叉棩蹇楋級锛宍GraphState` 鎸囧畾鐒︾偣锛宍scripts/project.json` 瀹氫箟鎵ц椤哄簭銆傚崗璁笉鍐嶉潬妯″瀷鑷閬靛畧锛岃€屾槸鍙樻垚 14 涓?`task_tree_*` 宸ュ叿鈥斺€斿啓鏍戣嚜鍔ㄥ浠藉埌 `versions/`銆佽嚜鍔ㄨ繃绮剧偧闂ㄧ銆佽嚜鍔ㄥ悓姝ユ祦绋嬬姸鎬侊紝骞朵笖**鏀逛笉鍔?*鐒︾偣銆?

闇€瑕?Node.js 20.11+ 鍜?Windows PowerShell锛堣繍琛屾椂璺ㄥ钩鍙帮紝瀹夎鑴氭湰鐩墠鏄?PowerShell锛夈€?

## 瑁呭埌涓€涓」鐩?

```powershell
powershell -File kit\deploy-task-tree.ps1 -ProjectRoot <浣犵殑椤圭洰璺緞> -UseSharedKit
```

浼氬湪璇ラ」鐩啓鍏ワ細`task-tree.md`锛堣捣濮嬫爲锛夈€乣AGENTS.md`锛堜换鍔″浘鍗忚 + 宸ュ叿浼樺厛瑙勫垯锛夈€乣scripts/`锛堟墽琛屾祦绋嬶級銆乣.cursor/rules/*.mdc`銆乣.cursor/mcp.json`銆乣llm-task-tree/` stub銆?

鎵撳紑鐣岄潰锛氶」鐩噷鐨?`llm-task-tree\open-task-tree.cmd`銆?

## 璁?Agent 鐢ㄤ笂宸ュ叿

**Cursor**锛氬畨瑁呭凡缁忓啓濂?`.cursor/mcp.json`锛屽叆鍙ｆ槸 `${workspaceFolder}/llm-task-tree/mcp-server.mjs`锛屼笉鍚粷瀵硅矾寰勶紝鍙互鐩存帴鎻愪氦杩涗綘鐨勪粨搴撯€斺€旈槦鍙嬪厠闅嗗悗鍚屾牱鍙敤銆傞噸鍚?Cursor 鐢熸晥銆?

**Codex**锛?

```bash
codex plugin marketplace add <owner>/<repo>     # 鏈粨搴?
node kit/scripts/install-codex-mcp.mjs --with-plugin
```

绗簩鏉″懡浠ゅ線 `~/.codex/config.toml` 杩藉姞 `[mcp_servers.task_tree]`锛屽啓鍓嶅浠斤紝閲嶅鎵ц鏄┖鎿嶄綔锛宍--remove` 鏁村潡鎾ら攢銆傛敞鍐岀殑鍏ュ彛鏄叡浜?kit锛屾墍浠ヤ竴鍙版満鍣ㄦ敞鍐屼竴娆★紝鎵€鏈夎浜?stub 鐨勯」鐩兘鑳界敤銆?

璇︾粏鐨勪笁鏉″垎鍙戣矾寰勮 [docs/share-with-others.zh.md](docs/share-with-others.zh.md)锛屾彃浠惰鏄庤 [marketplace/plugins/task-tree/README.md](marketplace/plugins/task-tree/README.md)銆?

## 鐩綍

```
kit/                              杩愯鏃讹細server.js銆乻erver/銆乸ublic/銆乻cripts/銆佹ā鏉裤€佸畨瑁呰剼鏈?
marketplace/plugins/task-tree/    鎻掍欢鍖咃紙Codex + Cursor 涓や唤娓呭崟锛屽叡鐢?SKILL.md锛?
.agents/plugins/marketplace.json  Codex 甯傚満娓呭崟锛堜粨搴撴牴锛屼緵 marketplace add 瑙ｆ瀽锛?
docs/                             鍒嗗彂璇存槑
```

## 璁稿彲

MIT