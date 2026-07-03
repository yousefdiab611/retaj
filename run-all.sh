#!/bin/bash

################################################################################
# RETAJ RMS - FULL PROJECT RUN SYSTEM (Bash)
# Backend + Frontend + Mobile Build Orchestration
################################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions for colored output
success() { echo -e "${GREEN}✔ $1${NC}"; }
error() { echo -e "${RED}✖ $1${NC}"; }
info() { echo -e "${CYAN}ℹ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
header() { echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"; echo -e "${BLUE}║ $1${NC}"; echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"; }

# Initialize tracking
declare -A ERROR_LOGS
declare -A SUCCESS_LOGS
declare -A BUILD_PATHS
ROOT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     RETAJ RMS - FULL PROJECT RUN SYSTEM (Bash)          ║${NC}"
echo -e "${BLUE}║            Backend + Frontend + Mobile Build             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
info "Root Path: $ROOT_PATH"
info "Start Time: $(date)"

################################################################################
# BACKEND BUILD
################################################################################
header "BACKEND MODULE"
info "Location: $ROOT_PATH/backend"

if [ ! -d "$ROOT_PATH/backend" ]; then
    error "Backend directory not found at $ROOT_PATH/backend"
    ERROR_LOGS["backend"]="Directory not found"
else
    cd "$ROOT_PATH/backend" || exit 1

    # 1. npm install
    if [ ! -d "node_modules" ]; then
        info "Running: npm install..."
        npm install > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            success "Backend dependencies installed"
            SUCCESS_LOGS["backend_install"]="npm install completed"
        else
            error "Backend npm install FAILED"
            ERROR_LOGS["backend"]="npm install failed"
        fi
    else
        info "node_modules exists, skipping npm install"
    fi

    # 2. Prisma generate
    if [ -z "${ERROR_LOGS[backend]}" ]; then
        info "Running: npx prisma generate..."
        npx prisma generate > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            success "Prisma client generated"
            SUCCESS_LOGS["backend_prisma"]="prisma generate completed"
        else
            error "Prisma generate FAILED"
            ERROR_LOGS["backend"]="prisma generate failed"
        fi
    fi

    # 3. npm build
    if [ -z "${ERROR_LOGS[backend]}" ]; then
        info "Running: npm run build..."
        npm run build > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            success "Backend built successfully"
            SUCCESS_LOGS["backend_build"]="TypeScript compilation completed"
            BUILD_PATHS["Backend"]="$ROOT_PATH/backend/dist"
        else
            error "Backend build FAILED"
            ERROR_LOGS["backend"]="Build failed"
        fi
    fi
fi

if [ -n "${ERROR_LOGS[backend]}" ]; then
    warning "Continuing with other modules..."
fi

################################################################################
# FRONTEND BUILD
################################################################################
header "FRONTEND MODULE"
info "Location: $ROOT_PATH/frontend"

if [ ! -d "$ROOT_PATH/frontend" ]; then
    error "Frontend directory not found at $ROOT_PATH/frontend"
    ERROR_LOGS["frontend"]="Directory not found"
else
    cd "$ROOT_PATH/frontend" || exit 1

    # 1. npm install
    if [ ! -d "node_modules" ]; then
        info "Running: npm install..."
        npm install > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            success "Frontend dependencies installed"
            SUCCESS_LOGS["frontend_install"]="npm install completed"
        else
            error "Frontend npm install FAILED"
            ERROR_LOGS["frontend"]="npm install failed"
        fi
    else
        info "node_modules exists, skipping npm install"
    fi

    # 2. npm build
    if [ -z "${ERROR_LOGS[frontend]}" ]; then
        info "Running: npm run build..."
        npm run build > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            success "Frontend built successfully"
            SUCCESS_LOGS["frontend_build"]="Vite build completed"
            BUILD_PATHS["Frontend"]="$ROOT_PATH/frontend/dist"
        else
            error "Frontend build FAILED"
            ERROR_LOGS["frontend"]="Build failed"
        fi
    fi

    # 3. Electron package
    if [ -z "${ERROR_LOGS[frontend]}" ]; then
        info "Running: npm run electron-pack:win..."
        npm run electron-pack:win > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            success "Desktop EXE built successfully"
            SUCCESS_LOGS["desktop_build"]="Electron Windows EXE packaged"
            BUILD_PATHS["Desktop"]="$ROOT_PATH/dist-electron"
        else
            warning "Desktop EXE build failed - continuing"
            ERROR_LOGS["desktop"]="Electron packaging failed"
        fi
    fi
fi

if [ -n "${ERROR_LOGS[frontend]}" ]; then
    warning "Continuing with other modules..."
fi

################################################################################
# MOBILE BUILD
################################################################################
header "MOBILE MODULE"
info "Location: $ROOT_PATH/mobile_cashier"

if [ ! -f "$ROOT_PATH/mobile_cashier/pubspec.yaml" ]; then
    warning "mobile_cashier/pubspec.yaml not found, skipping mobile build"
else
    if ! command -v flutter &> /dev/null; then
        warning "Flutter not found. Skipping mobile build."
        ERROR_LOGS["mobile"]="Flutter SDK not installed"
    else
        info "Flutter detected: $(flutter --version 2>&1 | head -1)"
        cd "$ROOT_PATH/mobile_cashier" || exit 1

        # 1. flutter pub get
        info "Running: flutter pub get..."
        flutter pub get > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            success "Flutter dependencies installed"
            SUCCESS_LOGS["mobile_pubget"]="flutter pub get completed"
        else
            error "Flutter pub get FAILED"
            ERROR_LOGS["mobile"]="flutter pub get failed"
        fi

        # 2. flutter build apk (release)
        if [ -z "${ERROR_LOGS[mobile]}" ]; then
            warning "Note: Flutter APK build is resource-intensive and may take 5-10 minutes..."
            info "Running: flutter build apk --release..."
            flutter build apk --release > /dev/null 2>&1
            if [ $? -eq 0 ]; then
                success "Mobile APK built successfully"
                SUCCESS_LOGS["mobile_build"]="Flutter APK build completed"
                BUILD_PATHS["Mobile"]="$ROOT_PATH/mobile_cashier/build/app/outputs/flutter-apk"
            else
                warning "Flutter APK build failed or skipped (common in CI/limited resources)"
                ERROR_LOGS["mobile"]="Flutter APK build failed"
            fi
        fi
    fi
fi

################################################################################
# SUMMARY REPORT
################################################################################
header "BUILD SUMMARY"

echo -e "\n📊 ${YELLOW}Module Status:${NC}\n"

if [ -n "${SUCCESS_LOGS[backend_build]}" ]; then
    success "Backend ready"
else
    error "Backend failed or incomplete"
fi

if [ -n "${SUCCESS_LOGS[frontend_build]}" ]; then
    success "Frontend ready"
else
    error "Frontend failed or incomplete"
fi

if [ -n "${SUCCESS_LOGS[mobile_build]}" ]; then
    success "Mobile ready"
elif [ -n "${ERROR_LOGS[mobile]}" ]; then
    warning "Mobile skipped/failed: ${ERROR_LOGS[mobile]}"
else
    info "Mobile not built"
fi

if [ -n "${SUCCESS_LOGS[desktop_build]}" ]; then
    success "Desktop ready"
elif [ -n "${ERROR_LOGS[desktop]}" ]; then
    warning "Desktop build failed: ${ERROR_LOGS[desktop]}"
else
    info "Desktop not built"
fi

echo -e "\n📁 ${YELLOW}Build Output Paths:${NC}\n"

for module in "${!BUILD_PATHS[@]}"; do
    path="${BUILD_PATHS[$module]}"
    if [ -d "$path" ]; then
        success "$module: $path"
    else
        warning "$module output path not found"
    fi
done

if [ ${#ERROR_LOGS[@]} -gt 0 ]; then
    echo -e "\n⚠ ${YELLOW}Error Log:${NC}\n"
    for err in "${!ERROR_LOGS[@]}"; do
        echo -e "  ${RED}[$err] ${ERROR_LOGS[$err]}${NC}"
    done
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo -e "\n⏱ ${CYAN}Execution Time: ${DURATION}s${NC}\n"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
if [ ${#ERROR_LOGS[@]} -eq 0 ]; then
    success "All modules completed successfully!"
else
    warning "Build completed with ${#ERROR_LOGS[@]} error(s) - see log above"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Exit with appropriate code
[ ${#ERROR_LOGS[@]} -eq 0 ] && exit 0 || exit 1
