#!/bin/bash
# dkcal - Operations script
# Usage: ./dkcal.sh {start|stop|restart|logs|status|useradd|passwd|userdel|userlist|purge}

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/logs/dkcal.pid"
LOG_FILE="$APP_DIR/logs/dkcal.log"
ACCOUNTS_FILE="$APP_DIR/data/accounts.json"

mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/data"

# Ensure accounts.json exists
if [ ! -f "$ACCOUNTS_FILE" ]; then
    echo "[]" > "$ACCOUNTS_FILE"
fi

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

do_useradd() {
    local username="$1"
    if [ -z "$username" ]; then
        echo "Usage: $0 useradd <identifiant>"
        exit 1
    fi

    # Validate username (alphanumeric + dashes + underscores only)
    if ! echo "$username" | grep -qE '^[a-zA-Z0-9_-]+$'; then
        echo "Erreur : l'identifiant ne peut contenir que des lettres, chiffres, tirets et underscores."
        exit 1
    fi

    # Check if user already exists
    if node -e "
        const accounts = JSON.parse(require('fs').readFileSync('$ACCOUNTS_FILE', 'utf-8'));
        if (accounts.some(a => a.username === '$username')) { process.exit(1); }
    " 2>/dev/null; then
        : # user doesn't exist, continue
    else
        echo "Erreur : l'utilisateur '$username' existe déjà."
        exit 1
    fi

    # Prompt for password
    read -rsp "Mot de passe : " password
    echo
    if [ -z "$password" ]; then
        echo "Erreur : mot de passe vide."
        exit 1
    fi
    read -rsp "Confirmer le mot de passe : " password2
    echo
    if [ "$password" != "$password2" ]; then
        echo "Erreur : les mots de passe ne correspondent pas."
        exit 1
    fi

    # Create account using Node.js (for bcrypt hashing)
    cd "$APP_DIR"
    node -e "
        const fs = require('fs');
        const bcrypt = require('bcryptjs');
        const accounts = JSON.parse(fs.readFileSync('$ACCOUNTS_FILE', 'utf-8'));
        const hash = bcrypt.hashSync(process.argv[1], 10);
        accounts.push({
            id: '$username',
            username: '$username',
            passwordHash: hash,
            created: new Date().toISOString()
        });
        fs.writeFileSync('$ACCOUNTS_FILE', JSON.stringify(accounts, null, 2));
    " "$password"

    if [ $? -eq 0 ]; then
        echo "Utilisateur '$username' créé."

        # If data/users/default exists and this is the first user, propose migration
        local user_count
        user_count=$(node -e "
            const accounts = JSON.parse(require('fs').readFileSync('$ACCOUNTS_FILE', 'utf-8'));
            console.log(accounts.length);
        ")

        if [ "$user_count" = "1" ] && [ -d "$APP_DIR/data/users/default" ]; then
            echo ""
            echo "Des données existantes ont été trouvées dans data/users/default/"
            read -rp "Migrer ces données vers l'utilisateur '$username' ? (oui/non) : " migrate
            if [ "$migrate" = "oui" ]; then
                mv "$APP_DIR/data/users/default" "$APP_DIR/data/users/$username"
                echo "Données migrées vers data/users/$username/"
            fi
        fi
    else
        echo "Erreur lors de la création de l'utilisateur."
        exit 1
    fi
}

do_passwd() {
    local username="$1"
    if [ -z "$username" ]; then
        echo "Usage: $0 passwd <identifiant>"
        exit 1
    fi

    # Check if user exists
    cd "$APP_DIR"
    if ! node -e "
        const accounts = JSON.parse(require('fs').readFileSync('$ACCOUNTS_FILE', 'utf-8'));
        if (!accounts.some(a => a.username === '$username')) { process.exit(1); }
    " 2>/dev/null; then
        echo "Erreur : l'utilisateur '$username' n'existe pas."
        exit 1
    fi

    read -rsp "Nouveau mot de passe : " password
    echo
    if [ -z "$password" ]; then
        echo "Erreur : mot de passe vide."
        exit 1
    fi
    read -rsp "Confirmer le mot de passe : " password2
    echo
    if [ "$password" != "$password2" ]; then
        echo "Erreur : les mots de passe ne correspondent pas."
        exit 1
    fi

    node -e "
        const fs = require('fs');
        const bcrypt = require('bcryptjs');
        const accounts = JSON.parse(fs.readFileSync('$ACCOUNTS_FILE', 'utf-8'));
        const acc = accounts.find(a => a.username === '$username');
        acc.passwordHash = bcrypt.hashSync(process.argv[1], 10);
        fs.writeFileSync('$ACCOUNTS_FILE', JSON.stringify(accounts, null, 2));
    " "$password"

    if [ $? -eq 0 ]; then
        echo "Mot de passe mis à jour pour '$username'."
    else
        echo "Erreur."
        exit 1
    fi
}

do_userdel() {
    local username="$1"
    if [ -z "$username" ]; then
        echo "Usage: $0 userdel <identifiant>"
        exit 1
    fi

    cd "$APP_DIR"
    if ! node -e "
        const accounts = JSON.parse(require('fs').readFileSync('$ACCOUNTS_FILE', 'utf-8'));
        if (!accounts.some(a => a.username === '$username')) { process.exit(1); }
    " 2>/dev/null; then
        echo "Erreur : l'utilisateur '$username' n'existe pas."
        exit 1
    fi

    echo "ATTENTION : Cela va supprimer l'utilisateur '$username' et toutes ses données."
    read -rp "Confirmer ? (oui/non) : " confirm
    if [ "$confirm" != "oui" ]; then
        echo "Annulé."
        exit 0
    fi

    # Remove from accounts.json
    node -e "
        const fs = require('fs');
        let accounts = JSON.parse(fs.readFileSync('$ACCOUNTS_FILE', 'utf-8'));
        accounts = accounts.filter(a => a.username !== '$username');
        fs.writeFileSync('$ACCOUNTS_FILE', JSON.stringify(accounts, null, 2));
    "

    # Remove data directory
    if [ -d "$APP_DIR/data/users/$username" ]; then
        rm -rf "$APP_DIR/data/users/$username"
        echo "Données de '$username' supprimées."
    fi

    echo "Utilisateur '$username' supprimé."
}

do_userlist() {
    cd "$APP_DIR"
    node -e "
        const fs = require('fs');
        const accounts = JSON.parse(fs.readFileSync('$ACCOUNTS_FILE', 'utf-8'));
        if (accounts.length === 0) {
            console.log('Aucun utilisateur.');
            return;
        }
        console.log('Utilisateurs (' + accounts.length + ') :');
        for (const a of accounts) {
            const created = a.created ? new Date(a.created).toLocaleDateString('fr-FR') : '?';
            console.log('  - ' + a.username + ' (créé le ' + created + ')');
        }
    "
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
    useradd)
        do_useradd "$2"
        ;;
    passwd)
        do_passwd "$2"
        ;;
    userdel)
        do_userdel "$2"
        ;;
    userlist)
        do_userlist
        ;;
    purge)
        USERNAME="$2"
        if [ -z "$USERNAME" ]; then
            echo "Usage: $0 purge <identifiant>"
            echo "Supprime les données d'un utilisateur sans supprimer son compte."
            exit 1
        fi
        DATA_DIR="$APP_DIR/data/users/$USERNAME"
        if [ ! -d "$DATA_DIR" ]; then
            echo "Aucune donnée à supprimer pour '$USERNAME'."
            exit 0
        fi
        echo "ATTENTION : Cette action va supprimer toutes les données de '$USERNAME' (items, jours, profil)."
        echo "Répertoire : $DATA_DIR"
        read -rp "Confirmer la suppression ? (oui/non) : " confirm
        if [ "$confirm" = "oui" ]; then
            rm -rf "$DATA_DIR"
            echo "Données de '$USERNAME' supprimées."
        else
            echo "Annulé."
        fi
        ;;
    *)
        echo "Usage: $0 <commande>"
        echo ""
        echo "Commandes serveur :"
        echo "  start       Démarrer le serveur"
        echo "  stop        Arrêter le serveur"
        echo "  restart     Redémarrer le serveur"
        echo "  logs        Afficher les logs en continu"
        echo "  status      État du serveur"
        echo ""
        echo "Gestion utilisateurs :"
        echo "  useradd <id>   Créer un utilisateur"
        echo "  passwd <id>    Changer le mot de passe"
        echo "  userdel <id>   Supprimer un utilisateur et ses données"
        echo "  userlist       Lister les utilisateurs"
        echo "  purge <id>     Supprimer les données d'un utilisateur"
        exit 1
        ;;
esac
