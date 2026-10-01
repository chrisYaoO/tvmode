on run
    set scriptPath to (POSIX path of (path to me)) & "../toggle_apple_tv.command"
    try
        do shell script "/bin/zsh " & quoted form of scriptPath
    on error errorMessage
        display alert "Apple TV 切换失败" message errorMessage as critical
    end try
end run
