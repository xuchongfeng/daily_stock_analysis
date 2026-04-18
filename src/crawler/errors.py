# -*- coding: utf-8 -*-


class CrawlError(Exception):
    """Recoverable or fatal crawl failure."""

    pass


class CrawlAuthError(CrawlError):
    """Site returned anti-bot / redirect instead of content."""

    pass
