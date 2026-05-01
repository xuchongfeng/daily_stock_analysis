# -*- coding: utf-8 -*-
"""
C 端（使用者站点）前端构建辅助：apps/dsa-user -> 项目根目录 static-user/

环境变量：
- USER_UI_AUTO_BUILD：启动时是否自动 npm 构建（默认 false；main.py 传入 --user-ui 时会启用构建逻辑）
- USER_UI_FORCE_BUILD：强制重新构建（等同 WEBUI_FORCE_BUILD）

未配置或构建失败时，若已有 static-user/ 产物仍可被 api.app 挂载。
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Iterable, Sequence

logger = logging.getLogger(__name__)

_FALSEY_ENV_VALUES = {"0", "false", "no", "off"}
_BUILD_INPUT_FILES = (
    "package.json",
    "package-lock.json",
    "vite.config.ts",
    "vite.config.js",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "eslint.config.js",
    "postcss.config.js",
    "tailwind.config.js",
    "index.html",
)
_BUILD_INPUT_DIRS = ("src", "public")


def _is_truthy_env(var_name: str, default: str = "true") -> bool:
    value = os.getenv(var_name, default).strip().lower()
    return value not in _FALSEY_ENV_VALUES


def _safe_mtime(path: Path) -> float:
    try:
        return path.stat().st_mtime
    except OSError:
        return 0.0


def _tree_latest_mtime(root: Path) -> float:
    if not root.exists():
        return 0.0
    latest = 0.0
    try:
        for p in root.rglob("*"):
            if p.is_file():
                latest = max(latest, _safe_mtime(p))
    except OSError:
        latest = max(latest, _safe_mtime(root))
    return latest


def _max_mtime(paths: Iterable[Path]) -> float:
    latest = 0.0
    for path in paths:
        latest = max(latest, _safe_mtime(path))
    return latest


def _resolve_user_artifact_index(frontend_dir: Path) -> Path:
    repo_root = frontend_dir.parent.parent
    static_user_index = (repo_root / "static-user" / "index.html").resolve()
    dist_index = frontend_dir / "dist" / "index.html"
    build_index = frontend_dir / "build" / "index.html"
    if static_user_index.exists():
        return static_user_index
    fallback_candidates = [p for p in (dist_index, build_index) if p.exists()]
    if not fallback_candidates:
        return static_user_index
    return max(fallback_candidates, key=_safe_mtime)


def _needs_dependency_install(frontend_dir: Path, package_json: Path, lock_file: Path, force_build: bool) -> bool:
    node_modules_dir = frontend_dir / "node_modules"
    install_marker = node_modules_dir / ".package-lock.json"
    deps_marker_mtime = _safe_mtime(install_marker) if install_marker.exists() else _safe_mtime(node_modules_dir)
    deps_input_mtime = _max_mtime((package_json, lock_file))
    return force_build or (not node_modules_dir.exists()) or (deps_marker_mtime < deps_input_mtime)


def _collect_build_inputs_latest_mtime(frontend_dir: Path) -> float:
    latest = _max_mtime(frontend_dir / filename for filename in _BUILD_INPUT_FILES if (frontend_dir / filename).exists())
    for dirname in _BUILD_INPUT_DIRS:
        latest = max(latest, _tree_latest_mtime(frontend_dir / dirname))
    return latest


def _needs_frontend_build(frontend_dir: Path, force_build: bool) -> tuple[bool, Path]:
    artifact_index = _resolve_user_artifact_index(frontend_dir)
    inputs_latest_mtime = _collect_build_inputs_latest_mtime(frontend_dir)
    artifact_mtime = _safe_mtime(artifact_index)
    needs_build = force_build or (not artifact_index.exists()) or (artifact_mtime < inputs_latest_mtime)
    return needs_build, artifact_index


def _run_frontend_commands(commands: Sequence[Sequence[str]], frontend_dir: Path) -> bool:
    try:
        for command in commands:
            logger.info("执行 C 端前端命令: %s", " ".join(command))
            subprocess.run(command, cwd=frontend_dir, check=True)
        logger.info("C 端前端静态资源构建完成")
        return True
    except subprocess.CalledProcessError as exc:
        cmd_display = " ".join(exc.cmd) if isinstance(exc.cmd, (list, tuple)) else str(exc.cmd)
        logger.error(
            "C 端前端命令执行失败（exit_code=%s）: %s",
            getattr(exc, "returncode", "N/A"),
            cmd_display,
        )
        return False


def _manual_build_command(frontend_dir: Path) -> str:
    lock_file = frontend_dir / "package-lock.json"
    install_cmd = "npm ci" if lock_file.exists() else "npm install"
    return f'cd "{frontend_dir}" && {install_cmd} && npm run build'


def _has_static_assets(static_dir: Path) -> bool:
    assets_dir = static_dir / "assets"
    if not assets_dir.is_dir():
        return False
    try:
        return any(
            f.suffix in (".js", ".css") and f.is_file()
            for f in assets_dir.iterdir()
        )
    except OSError:
        return False


def _warn_if_assets_missing(artifact_index: Path, frontend_dir: Path) -> None:
    static_dir = artifact_index.parent
    assets_dir = static_dir / "assets"
    if not _has_static_assets(static_dir):
        logger.warning(
            "检测到 %s 但 %s 无有效 CSS/JS，C 端页面可能显示异常",
            artifact_index,
            assets_dir,
        )
        logger.warning("请手动构建: %s", _manual_build_command(frontend_dir))


def prepare_user_frontend_assets(*, enabled: bool | None = None) -> bool:
    """
    准备 C 端 static-user 产物。

    enabled:
      - True: 按自动构建逻辑执行（等同 USER_UI_AUTO_BUILD=true）
      - False: 不构建，仅检查产物是否存在
      - None: 读取环境变量 USER_UI_AUTO_BUILD（默认 false）
    """
    frontend_dir = Path(__file__).resolve().parent.parent / "apps" / "dsa-user"
    if enabled is True:
        auto_build_enabled = True
    elif enabled is False:
        auto_build_enabled = False
    else:
        auto_build_enabled = _is_truthy_env("USER_UI_AUTO_BUILD", "false")

    artifact_index = _resolve_user_artifact_index(frontend_dir)

    if not auto_build_enabled:
        if artifact_index.exists():
            logger.info("USER_UI_AUTO_BUILD=false，检测到 C 端静态产物: %s", artifact_index)
            _warn_if_assets_missing(artifact_index, frontend_dir)
            return True
        logger.warning("未检测到 C 端静态产物: %s", artifact_index)
        logger.warning("可使用 python main.py --serve-only --user-ui 在启动时构建，或手动: %s", _manual_build_command(frontend_dir))
        return False

    force_build = _is_truthy_env("USER_UI_FORCE_BUILD", "false")
    needs_build, artifact_index = _needs_frontend_build(frontend_dir=frontend_dir, force_build=force_build)

    if not needs_build:
        logger.info("检测到可复用的 C 端静态产物，跳过构建: %s", artifact_index)
        _warn_if_assets_missing(artifact_index, frontend_dir)
        return True

    package_json = frontend_dir / "package.json"
    if not package_json.exists():
        logger.warning("未找到 C 端前端项目: %s", package_json)
        return False

    npm_path = shutil.which("npm")
    if not npm_path:
        logger.warning("未检测到 npm，无法构建 C 端前端")
        return False

    lock_file = frontend_dir / "package-lock.json"
    needs_install = _needs_dependency_install(
        frontend_dir=frontend_dir,
        package_json=package_json,
        lock_file=lock_file,
        force_build=force_build,
    )

    commands = []
    if needs_install:
        lock_exists = (frontend_dir / "package-lock.json").exists()
        commands.append([npm_path, "ci" if lock_exists else "install"])
    if needs_build:
        commands.append([npm_path, "run", "build"])

    logger.info(
        "C 端构建检查: needs_install=%s, needs_build=%s, artifact=%s",
        needs_install,
        needs_build,
        artifact_index,
    )
    return _run_frontend_commands(commands=commands, frontend_dir=frontend_dir)
