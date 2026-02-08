#!/bin/bash
# dkcal - Operations script
# Usage: ./dkcal.sh {start|stop|restart|logs|status}

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/logs/dkcal.pid"
LOG_FILE="$APP_DIR/logs/dkcal.log"

mkdir -p "$APP_DIR/logs"

get_pid() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "$pid"
            return 0
        fi
        rm -f "$PID_FILE"
    fi
    return 1
}

do_start() {
    local existing
    existing=$(get_pid)
    if [ -n "$existing" ]; then
        echo "dkcal is already running (PID $existing)"
        return 1
    fi

    cd "$APP_DIR"
    node server.js >> "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"

    # Verify it actually started
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
        echo "dkcal started (PID $pid)"
    else
        echo "dkcal failed to start, check logs: $LOG_FILE"
        rm -f "$PID_FILE"
        tail -5 "$LOG_FILE"
        return 1
    fi
}

do_stop() {
    local pid
    pid=$(get_pid)
    if [ -z "$pid" ]; then
        echo "dkcal is not running"
        return 0
    fi

    kill "$pid" 2>/dev/null

    # Wait for process to actually die (up to 5s)
    local count=0
    while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
        sleep 0.5
        count=$((count + 1))
    done

    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null
        echo "dkcal force-killed (PID $pid)"
    else
        echo "dkcal stopped (PID $pid)"
    fi

    rm -f "$PID_FILE"
}

case "$1" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_stop
        sleep 1
        do_start
        ;;
    logs)
        tail -f "$LOG_FILE"
        ;;
    status)
        pid=$(get_pid)
        if [ -n "$pid" ]; then
            echo "dkcal is running (PID $pid)"
        else
            echo "dkcal is not running"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status}"
        exit 1
        ;;
esac
