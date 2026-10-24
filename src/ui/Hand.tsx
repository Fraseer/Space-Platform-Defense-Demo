// The hand of cards along the bottom of the screen.

import { CARDS, type GameState } from '../sim';

interface Props {
  state: GameState;
  selectedUid: number | null;
  disabled: boolean;
  onPick: (uid: number) => void;
  onDiscard: (uid: number) => void;
}

export function Hand({ state, selectedUid, disabled, onPick, onDiscard }: Props) {
  return (
    <div className="hand">
      {state.deck.hand.map((inst) => {
        const card = CARDS[inst.cardId];
        const affordable = state.power >= card.cost.power && state.matter >= (card.cost.matter ?? 0);
        return (
          <button
            key={inst.uid}
            className={`card card-${card.type} ${selectedUid === inst.uid ? 'sel' : ''} ${affordable ? '' : 'poor'}`}
            disabled={disabled}
            onClick={() => onPick(inst.uid)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!disabled) onDiscard(inst.uid);
            }}
            title={`${card.text}\nRight-click to scrap (${state.discardsLeft} left this turn).`}
          >
            <div className="card-cost">
              <span className="c-power">⚡{card.cost.power}</span>
              {card.cost.matter ? <span className="c-matter">◈{card.cost.matter}</span> : null}
            </div>
            <div className="card-name">{card.name}</div>
            <div className="card-type">{card.type}</div>
            <div className="card-text">{card.text}</div>
          </button>
        );
      })}
      <div className="piles">
        <div>Draw {state.deck.draw.length}</div>
        <div>Discard {state.deck.discard.length}</div>
        {state.deck.exhausted.length > 0 && <div>Exhausted {state.deck.exhausted.length}</div>}
        <div title="Right-click a card to scrap it into the discard pile.">Scrap {state.discardsLeft} (right-click)</div>
      </div>
    </div>
  );
}
