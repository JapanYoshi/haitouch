/*
Adds a "play in fullscreen" button to the game's listing.
Intended for good UX om Mobile.
*/
fscrn = ()=>{
    document.documentElement.requestFullscreen(
        { navigationUI: 'hide' }
    )
};

document.addEventListener("DOMContentLoaded", ()=>{
    var button = document.createElement("button");
    button.classList.add("fs_button");
    button.type = "button";
    button.addEventListener("click", fscrn);
        
    var label = document.createElement("div");
    label.classList.add("fs_label");
    label.innerText = "Fullscreen";
    button.appendChild(label)
    
    var footnote = document.createElement("div");
    footnote.classList.add("fs_footnote");
    footnote.innerText = "or press F11 on PC";
    button.appendChild(footnote)
    
    document.body.appendChild(button);

    // also add to the Play Here link
    document.getElementById("play_here").addEventListener("click", fscrn);
});