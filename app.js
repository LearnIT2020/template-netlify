/*!
 * template-netlify
 *
 * Copyright 2020 learn it 2020
 */ 

let Util = {
  kanjiGradeMaster : null,
  kuromojiTokenizer : null,

  isKuromojiTokenizerAvailable : function() {
    return this.kuromojiTokenizer != null;
  },

  getKuromojiTokenizer : function() {
    let self = this;

    return new Promise( (resolve, reject) => {
      if ( this.kuromojiTokenizer === null ) {
        kuromoji.builder({ dicPath: "./kuromoji/dict" }).build(function (err, tokenizer) {
          // tokenizer is ready
          self.kuromojiTokenizer = tokenizer;
          resolve();
        });
      } else {
        resolve();
      }
    } );
  }
};

// after DOM contents are loaded
window.addEventListener( "DOMContentLoaded", function() {
  // setup 


  // Execute Click
  const actionClickExecuteCheck = async ( event ) => {
    console.log( "Execute button clicked." );
    let src = document.getElementById( "originalText" );
    let dest = document.getElementById( "resultArea" );

    if ( !kanjiGradeUtil.isKuromojiTokenizerAvailable() ) {
      let modalProgress = document.getElementById( "progress-modal" );
      let progressCaption = document.getElementById( "progress-caption" );
      progressCaption.innerHTML = "フリガナ処理を初期化しています";
      modalProgress.classList.toggle('is-active');
      await kanjiGradeUtil.getKuromojiTokenizer();
      modalProgress.classList.toggle('is-active');
    }
    resetGradeButtonColor();
    dest.innerHTML = kanjiGradeUtil.extractCheckedResult( src.value );  
  };
  let btnExecCheck = document.getElementById( "buttonExecCheck" ); 
  btnExecCheck.addEventListener( "click", actionClickExecuteCheck, false );



  // Recognize texts by OCR
  const recognizCapture = async ( event ) => {
    let canvas = document.getElementById( "result-canvas" );
    let modalCapture = document.getElementById( "camera-modal" );
    let modalProgress = document.getElementById( "progress-modal" );
    let progressCaption = document.getElementById( "progress-caption" );
    let direction = document.getElementById( "detect-direction" );
    const direction_value = direction.options[direction.selectedIndex].value;
    let localServer = document.getElementById( "local-server-flag" );
    let localServerFlag = localServer.checked;
    let ocrLanguage = "jpn";
    let ocrSegMode = 6;
    if ( direction_value == "vertical" ) {
      ocrLanguage = "jpn_vert";
      ocrSegMode = 5;
    }
    progressCaption.innerHTML = "画像から文字を認識しています";
 
    modalProgress.classList.toggle( "is-active" );
 　 
    let ocrresult = null;

    if ( localServerFlag )
    {
      try {
        let url = "https://kanji-grade-checker.netlify.app/.netlify/functions/ocr";
        if ( document.location.host.indexOf('kanji-grade-checker.now.sh') != -1 ) {
          url = "https://kanji-grade-checker.now.sh/api/ocr";
        }
        const canvas_image = canvas.toDataURL("image/png");

        // echo for check ocr server activity
        let echoparams = new URLSearchParams();
        echoparams.set("type", "echo");

        // try to get echo request 3 times
        let echoFlag = false;
        for(let i = 0; i < 3; i++) {
          const echo_res = await fetch(url + "?" + echoparams.toString());
          const result_echo = await echo_res.data;
          if ( echo_res.ok ) {
            echoFlag = true;
            break;
          }
        }
        if ( !echoFlag ) {
          progressCaption.innerHTML = "OCRサーバーの接続確認に失敗しました。";
          throw new Error("Failed to get echo response.");                    
        }

        const fetch_recognize_res = await fetch(url, {
          method: "POST",
          headers: { "Accept": "application/json", "Content-Type": "application/json"},
          body: JSON.stringify({"type": "recognize",
                                "data": canvas_image, 
                                "direction": direction_value})
        });
        const result_recognize_json = await fetch_recognize_res.json();
        if( !fetch_recognize_res.ok ) {
          progressCaption.innerHTML = "OCR結果の取得に失敗しました。";
          throw new Error("Failed to get recognize response.");        
        }

        if(result_recognize_json["status"] == "error"){ //WEBAPI側で"error"と判断されたらアラートする
          progressCaption.innerHTML = "OCR結果の取得に失敗しました。";
          throw new Error("Failed to get recognize response.");        
        }

        const orc_request_id = result_recognize_json['requestid']; 
        let resultparams = new URLSearchParams();
        resultparams.set("type", "result");
        resultparams.set("requestid", orc_request_id);
        for (let i = 0;  i < 30;  i++) {
          const echo_res = await fetch(url + '?' + resultparams.toString())
          const result_result = await echo_res.json()
          if ( "result" in result_result && 
               "status" in result_result &&
               result_result["status"] == "success") {
            ocrresult = result_result['result']
            break;
          }
          await new Promise(r => setTimeout(r,1500));
        }
        if ( ocrresult == null ) {
          progressCaption.innerHTML = "OCR結果の取得に失敗しました。";
          ocrresult = "読み取り失敗";
          await new Promise(r => setTimeout(r,2000));
        }
      } catch (e) {
        progressCaption.innerHTML = "OCRサーバーの呼び出しに失敗しました。";
        await new Promise(r => setTimeout(r,2000));
      }
    } else {
      const { data: { text } } = await Tesseract.recognize(canvas, ocrLanguage, {
          tessedit_char_blacklist : "e",
          tessedit_pageseg_mode : ocrSegMode,
          preserve_interword_spaces : 0
      });
      // check recognition result
      ocrresult = text.replace(/ /g,"");  // current hack, captured result often include unexpected space.
      if ( ocrresult.length === 0 ) {
        progressCaption.innerHTML = "文字を認識できませんでした";
        ocrresult = "読み取り失敗";
        await new Promise(r => setTimeout(r,2000));
      }
      else {
        modalCapture.classList.toggle( "is-active" );
      }
    }

    modalProgress.classList.toggle( "is-active" );

    let target = document.getElementById( "originalText" );
    target.value = ocrresult;
  };
  let btnRecognizeCapture = document.getElementById( "recognize-capture" );
  btnRecognizeCapture.addEventListener( "click", recognizCapture );

  // global utility setup
  kanjiGradeUtil.loadKanjiGradeMaster( "kanji_grade_info.json" );
  //kanjiGradeUtil.getKuromojiTokenizer();


  for (const element of document.querySelectorAll(".modal .close-modal, .show-modal")) {
    element.addEventListener( "click", ( event ) => {
        const modalId = element.dataset.target;
        const modal = document.getElementById( modalId );
        modal.classList.toggle( "is-active" );
    } );
  }

  for (const element of document.querySelectorAll('.stop-camera')) {
    element.addEventListener( "click", ( event ) => {
        const video = document.getElementById("video-camera");
        if ( video.srcObject != null )
        {
          video.srcObject.getTracks().forEach( track => track.stop() );
          video.srcObject = null;
        }
    } );
  }  

});


