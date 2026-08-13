function ema(previous,current,alpha=.3){if(previous==null||!Number.isFinite(previous))return current;return alpha*current+(1-alpha)*previous}module.exports={ema};
